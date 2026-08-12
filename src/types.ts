import type Matter from 'matter-js';

export interface Point2D {
  x: number;
  y: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  screenLandmarks: Point2D[];
  handedness: 'Left' | 'Right';
}

export type GestureType = 'idle' | 'spawn' | 'poke' | 'grab';

export interface GestureState {
  type: GestureType;
  isPinching: boolean;
  pinchDistance: number;
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  thumbExtended: boolean;
  spawnGestureActive: boolean;
  spawnDebounceStart: number | null;
}

export interface FingerTipData {
  indexTip: Point2D;
  thumbTip: Point2D;
  pinchPoint: Point2D;
  velocity: Point2D;
}

export interface PhysicsBall {
  body: Matter.Body;
  color: string;
  isGrabbed: boolean;
}

export interface AppConfig {
  pinchGrabThreshold: number;
  pinchReleaseThreshold: number;
  pokeRadius: number;
  impulseStrength: number;
  maxImpulse: number;
  spawnDebounceMs: number;
  ballRadius: number;
  grabRadius: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  pinchGrabThreshold: 0.06,
  pinchReleaseThreshold: 0.09,
  pokeRadius: 40,
  impulseStrength: 0.05,
  maxImpulse: 0.3,
  spawnDebounceMs: 300,
  ballRadius: 30,
  grabRadius: 50,
};

// MediaPipe landmark indices
export const LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;
