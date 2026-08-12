import Matter from 'matter-js';
import type { Point2D, PhysicsBall } from './types';

const { Engine, Bodies, Body, Composite } = Matter;

let engine: Matter.Engine;
let world: Matter.World;
let balls: PhysicsBall[] = [];
let walls: Matter.Body[] = [];

let canvasWidth = 800;
let canvasHeight = 600;

const WALL_THICKNESS = 50;

// Random color generator for balls
function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export function initPhysics(width: number, height: number): void {
  canvasWidth = width;
  canvasHeight = height;

  engine = Engine.create({
    gravity: { x: 0, y: 0, scale: 0 }, // No gravity - balls float freely
  });
  world = engine.world;

  createWalls();
}

export function resizePhysics(width: number, height: number): void {
  canvasWidth = width;
  canvasHeight = height;

  // Remove old walls
  for (const wall of walls) {
    Composite.remove(world, wall);
  }
  walls = [];

  // Create new walls
  createWalls();
}

function createWalls(): void {
  // Floor
  const floor = Bodies.rectangle(
    canvasWidth / 2,
    canvasHeight + WALL_THICKNESS / 2,
    canvasWidth + WALL_THICKNESS * 2,
    WALL_THICKNESS,
    { isStatic: true, restitution: 0.6, friction: 0.3 }
  );

  // Left wall
  const leftWall = Bodies.rectangle(
    -WALL_THICKNESS / 2,
    canvasHeight / 2,
    WALL_THICKNESS,
    canvasHeight + WALL_THICKNESS * 2,
    { isStatic: true, restitution: 0.6, friction: 0.3 }
  );

  // Right wall
  const rightWall = Bodies.rectangle(
    canvasWidth + WALL_THICKNESS / 2,
    canvasHeight / 2,
    WALL_THICKNESS,
    canvasHeight + WALL_THICKNESS * 2,
    { isStatic: true, restitution: 0.6, friction: 0.3 }
  );

  // Ceiling (optional, keeps balls from flying off top)
  const ceiling = Bodies.rectangle(
    canvasWidth / 2,
    -WALL_THICKNESS / 2,
    canvasWidth + WALL_THICKNESS * 2,
    WALL_THICKNESS,
    { isStatic: true, restitution: 0.6, friction: 0.3 }
  );

  walls = [floor, leftWall, rightWall, ceiling];
  Composite.add(world, walls);
}

export function createBall(position: Point2D, radius: number): PhysicsBall {
  const body = Bodies.circle(position.x, position.y, radius, {
    restitution: 0.95, // Very bouncy
    friction: 0.01,
    frictionAir: 0.002, // Minimal air resistance
    density: 0.001,
  });

  Composite.add(world, body);

  const ball: PhysicsBall = {
    body,
    color: randomColor(),
    isGrabbed: false,
  };

  balls.push(ball);
  return ball;
}

export function removeBall(ball: PhysicsBall): void {
  Composite.remove(world, ball.body);
  const index = balls.indexOf(ball);
  if (index > -1) {
    balls.splice(index, 1);
  }
}

export function getBalls(): PhysicsBall[] {
  return balls;
}

export function applyForce(body: Matter.Body, force: Point2D): void {
  Body.applyForce(body, body.position, force);
}

export function setBodyPosition(body: Matter.Body, position: Point2D): void {
  Body.setPosition(body, position);
}

export function setBodyVelocity(body: Matter.Body, velocity: Point2D): void {
  Body.setVelocity(body, velocity);
}

export function setBodyStatic(body: Matter.Body, isStatic: boolean): void {
  Body.setStatic(body, isStatic);
}

export function getBodyPosition(body: Matter.Body): Point2D {
  return { x: body.position.x, y: body.position.y };
}

export function getBodyVelocity(body: Matter.Body): Point2D {
  return { x: body.velocity.x, y: body.velocity.y };
}

export function stepPhysics(delta: number): void {
  Engine.update(engine, delta);
}

export function getEngine(): Matter.Engine {
  return engine;
}
