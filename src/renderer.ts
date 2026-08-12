import type { Point2D } from './types';
import { getBalls, getBodyPosition } from './physics';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// Finger/pinch indicators
let fingerPos: Point2D | null = null;
let pinchPos: Point2D | null = null;
let showFinger = false;
let showPinch = false;

export function initRenderer(canvasElement: HTMLCanvasElement): void {
  canvas = canvasElement;
  ctx = canvas.getContext('2d')!;
}

export function resizeRenderer(width: number, height: number): void {
  canvas.width = width;
  canvas.height = height;
}

export function setFingerIndicator(pos: Point2D | null, visible: boolean): void {
  fingerPos = pos;
  showFinger = visible;
}

export function setPinchIndicator(pos: Point2D | null, visible: boolean): void {
  pinchPos = pos;
  showPinch = visible;
}

export function render(ballRadius: number): void {
  // Clear canvas (transparent to show video beneath)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const balls = getBalls();

  // Draw balls
  for (const ball of balls) {
    const pos = getBodyPosition(ball.body);
    const angle = ball.body.angle;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    // Ball shadow
    ctx.beginPath();
    ctx.arc(3, 3, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Ball body
    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    // Ball highlight
    ctx.beginPath();
    ctx.arc(-ballRadius * 0.3, -ballRadius * 0.3, ballRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();

    // Ball outline
    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Grabbed indicator
    if (ball.isGrabbed) {
      ctx.beginPath();
      ctx.arc(0, 0, ballRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw finger indicator (poke mode)
  if (showFinger && fingerPos) {
    ctx.beginPath();
    ctx.arc(fingerPos.x, fingerPos.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Direction indicator ring
    ctx.beginPath();
    ctx.arc(fingerPos.x, fingerPos.y, 20, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw pinch indicator (grab mode)
  if (showPinch && pinchPos) {
    ctx.beginPath();
    ctx.arc(pinchPos.x, pinchPos.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawLandmarks(landmarks: Point2D[]): void {
  if (landmarks.length === 0) return;

  // Draw connections
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], // Palm
  ];

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
  ctx.lineWidth = 2;

  for (const [start, end] of connections) {
    const startPt = landmarks[start];
    const endPt = landmarks[end];
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();
  }

  // Draw landmark points
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];

    // Fingertips are larger and different color
    if ([4, 8, 12, 16, 20].includes(i)) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff6b6b';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#4ecdc4';
      ctx.fill();
    }
  }

  // Draw pinch line (thumb to index)
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  ctx.beginPath();
  ctx.moveTo(thumbTip.x, thumbTip.y);
  ctx.lineTo(indexTip.x, indexTip.y);
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function getCanvasSize(): { width: number; height: number } {
  return { width: canvas.width, height: canvas.height };
}
