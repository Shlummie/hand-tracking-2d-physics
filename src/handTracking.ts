import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandLandmark, Point2D, HandData } from './types';

let handLandmarker: HandLandmarker | null = null;
let lastVideoTime = -1;

export async function initHandTracking(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export function detectHands(video: HTMLVideoElement, timestamp: number): HandData | null {
  if (!handLandmarker || video.currentTime === lastVideoTime) {
    return null;
  }
  lastVideoTime = video.currentTime;

  const results = handLandmarker.detectForVideo(video, timestamp);

  if (!results.landmarks || results.landmarks.length === 0) {
    return null;
  }

  const landmarks: HandLandmark[] = results.landmarks[0].map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
  }));

  const handedness =
    results.handednesses && results.handednesses[0]
      ? (results.handednesses[0][0].categoryName as 'Left' | 'Right')
      : 'Right';

  return {
    landmarks,
    screenLandmarks: [], // Will be computed by convertToScreenCoords
    handedness,
  };
}

// Convert normalized landmarks [0,1] to screen pixel coordinates
// Note: x is mirrored because video is mirrored
export function convertToScreenCoords(
  landmarks: HandLandmark[],
  screenWidth: number,
  screenHeight: number
): Point2D[] {
  return landmarks.map((lm) => ({
    // Mirror x because video feed is mirrored
    x: (1 - lm.x) * screenWidth,
    y: lm.y * screenHeight,
  }));
}
