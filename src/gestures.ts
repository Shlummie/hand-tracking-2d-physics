import type { HandLandmark, Point2D, GestureState, FingerTipData, AppConfig } from './types';
import { LANDMARK } from './types';

// Velocity tracking with EMA smoothing
let prevIndexTip: Point2D | null = null;
let prevTimestamp = 0;
let smoothedVelocity: Point2D = { x: 0, y: 0 };
const EMA_ALPHA = 0.3;

// Pinch state machine
let isPinching = false;

// Spawn gesture debounce
let spawnDebounceStart: number | null = null;
let lastSpawnTime = 0;

export function resetGestureState(): void {
  prevIndexTip = null;
  prevTimestamp = 0;
  smoothedVelocity = { x: 0, y: 0 };
  isPinching = false;
  spawnDebounceStart = null;
}

// Check if a finger is extended (for index, middle, ring, pinky)
// Compare tip.y vs pip.y - tip above pip means extended (y increases downward)
function isFingerExtended(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number
): boolean {
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  // In image space, y increases downward, so tip.y < pip.y means extended
  return tip.y < pip.y - 0.02;
}

// Check if thumb is extended based on handedness
function isThumbExtended(
  landmarks: HandLandmark[],
  handedness: 'Left' | 'Right'
): boolean {
  const thumbTip = landmarks[LANDMARK.THUMB_TIP];
  const thumbIP = landmarks[LANDMARK.THUMB_IP];
  const indexMCP = landmarks[LANDMARK.INDEX_MCP];

  const thumbToIndex = Math.abs(thumbTip.x - indexMCP.x);

  if (handedness === 'Right') {
    // Camera shows left, thumb extends to the right of the palm
    return thumbTip.x > thumbIP.x + 0.02 && thumbToIndex > 0.08;
  } else {
    // Camera shows right, thumb extends to the left of the palm
    return thumbTip.x < thumbIP.x - 0.02 && thumbToIndex > 0.08;
  }
}

function distanceNormalized(a: HandLandmark, b: HandLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function analyzeGestures(
  landmarks: HandLandmark[],
  screenLandmarks: Point2D[],
  handedness: 'Left' | 'Right',
  timestamp: number,
  config: AppConfig
): { gestureState: GestureState; fingerTipData: FingerTipData; shouldSpawn: boolean } {
  // Check finger extensions
  const indexExtended = isFingerExtended(landmarks, LANDMARK.INDEX_TIP, LANDMARK.INDEX_PIP);
  const middleExtended = isFingerExtended(landmarks, LANDMARK.MIDDLE_TIP, LANDMARK.MIDDLE_PIP);
  const ringExtended = isFingerExtended(landmarks, LANDMARK.RING_TIP, LANDMARK.RING_PIP);
  const pinkyExtended = isFingerExtended(landmarks, LANDMARK.PINKY_TIP, LANDMARK.PINKY_PIP);
  const thumbExtended = isThumbExtended(landmarks, handedness);

  // Calculate pinch distance (normalized space for threshold comparison)
  const pinchDistanceNorm = distanceNormalized(
    landmarks[LANDMARK.THUMB_TIP],
    landmarks[LANDMARK.INDEX_TIP]
  );

  // Pinch state machine with hysteresis
  if (!isPinching && pinchDistanceNorm < config.pinchGrabThreshold) {
    isPinching = true;
  } else if (isPinching && pinchDistanceNorm > config.pinchReleaseThreshold) {
    isPinching = false;
  }

  // Get fingertip screen positions
  const indexTip = screenLandmarks[LANDMARK.INDEX_TIP];
  const thumbTip = screenLandmarks[LANDMARK.THUMB_TIP];

  // Pinch point is midpoint between thumb and index tips
  const pinchPoint: Point2D = {
    x: (indexTip.x + thumbTip.x) / 2,
    y: (indexTip.y + thumbTip.y) / 2,
  };

  // Calculate velocity from frame-to-frame delta
  let velocity: Point2D = { x: 0, y: 0 };
  if (prevIndexTip && prevTimestamp > 0) {
    const dt = (timestamp - prevTimestamp) / 1000; // Convert to seconds
    if (dt > 0 && dt < 0.5) {
      const rawVel: Point2D = {
        x: (indexTip.x - prevIndexTip.x) / dt,
        y: (indexTip.y - prevIndexTip.y) / dt,
      };

      // EMA smoothing
      smoothedVelocity = {
        x: EMA_ALPHA * rawVel.x + (1 - EMA_ALPHA) * smoothedVelocity.x,
        y: EMA_ALPHA * rawVel.y + (1 - EMA_ALPHA) * smoothedVelocity.y,
      };
      velocity = smoothedVelocity;
    }
  }

  prevIndexTip = { ...indexTip };
  prevTimestamp = timestamp;

  // Determine spawn gesture: 4 fingers extended, thumb NOT extended
  const spawnGestureActive =
    indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended;

  // Debounce spawn gesture
  let shouldSpawn = false;
  if (spawnGestureActive) {
    if (spawnDebounceStart === null) {
      spawnDebounceStart = timestamp;
    } else if (
      timestamp - spawnDebounceStart >= config.spawnDebounceMs &&
      timestamp - lastSpawnTime > config.spawnDebounceMs * 2
    ) {
      shouldSpawn = true;
      lastSpawnTime = timestamp;
      spawnDebounceStart = null;
    }
  } else {
    spawnDebounceStart = null;
  }

  // Determine gesture type
  let gestureType: GestureState['type'] = 'idle';

  if (spawnGestureActive && spawnDebounceStart !== null) {
    gestureType = 'spawn';
  } else if (isPinching) {
    gestureType = 'grab';
  } else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    gestureType = 'poke';
  }

  const gestureState: GestureState = {
    type: gestureType,
    isPinching,
    pinchDistance: pinchDistanceNorm,
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
    thumbExtended,
    spawnGestureActive,
    spawnDebounceStart,
  };

  const fingerTipData: FingerTipData = {
    indexTip,
    thumbTip,
    pinchPoint,
    velocity,
  };

  return { gestureState, fingerTipData, shouldSpawn };
}

export function getVelocityMagnitude(velocity: Point2D): number {
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}
