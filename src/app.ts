import { initHandTracking, detectHands, convertToScreenCoords } from './handTracking';
import { analyzeGestures, getVelocityMagnitude, resetGestureState } from './gestures';
import {
  initPhysics,
  resizePhysics,
  createBall,
  getBalls,
  applyForce,
  setBodyPosition,
  setBodyVelocity,
  setBodyStatic,
  getBodyPosition,
  stepPhysics,
} from './physics';
import {
  initRenderer,
  resizeRenderer,
  setFingerIndicator,
  setPinchIndicator,
  render,
  drawLandmarks,
} from './renderer';
import type { AppConfig, Point2D, PhysicsBall, GestureState, FingerTipData } from './types';
import { DEFAULT_CONFIG } from './types';

// App state
let config: AppConfig = { ...DEFAULT_CONFIG };
let isRunning = false;
let selectedCameraId: string | null = null;
let currentCameraName = '';

// DOM elements
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;

// Screen dimensions
let screenWidth = 0;
let screenHeight = 0;

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// Grab state
let grabbedBall: PhysicsBall | null = null;
let grabVelocityHistory: Point2D[] = [];
const VELOCITY_HISTORY_SIZE = 8;
let lastGrabPos: Point2D | null = null;
let lastGrabTime = 0;

// Poke cooldown per ball
const pokeCooldowns = new Map<PhysicsBall, number>();
const POKE_COOLDOWN_MS = 200;

async function enumerateCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    console.error('Camera permission denied');
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

async function populateCameraSelect(): Promise<void> {
  const select = document.getElementById('camera-select') as HTMLSelectElement;
  const cameras = await enumerateCameras();

  select.innerHTML = '';

  let obsIndex = -1;
  cameras.forEach((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.text = camera.label || `Camera ${index + 1}`;
    select.appendChild(option);

    if (camera.label.toLowerCase().includes('obs')) {
      obsIndex = index;
    }
  });

  if (obsIndex >= 0) {
    select.selectedIndex = obsIndex;
  }
}

async function startCamera(deviceId: string): Promise<void> {
  const constraints: MediaStreamConstraints = {
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    const track = stream.getVideoTracks()[0];
    currentCameraName = track.label || 'Unknown';
    document.getElementById('camera-name')!.textContent =
      currentCameraName.length > 15 ? currentCameraName.substring(0, 15) + '...' : currentCameraName;

    await video.play();
  } catch (error) {
    console.error('Error starting camera:', error);
    alert('Failed to start camera. Please check permissions and try again.');
  }
}

function handleResize(): void {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  resizeRenderer(screenWidth, screenHeight);
  resizePhysics(screenWidth, screenHeight);
}

function setupControlListeners(): void {
  const pinchGrabSlider = document.getElementById('pinch-grab-threshold') as HTMLInputElement;
  pinchGrabSlider.addEventListener('input', () => {
    config.pinchGrabThreshold = parseFloat(pinchGrabSlider.value);
    document.getElementById('pinch-grab-value')!.textContent = config.pinchGrabThreshold.toFixed(3);
  });

  const pinchReleaseSlider = document.getElementById('pinch-release-threshold') as HTMLInputElement;
  pinchReleaseSlider.addEventListener('input', () => {
    config.pinchReleaseThreshold = parseFloat(pinchReleaseSlider.value);
    document.getElementById('pinch-release-value')!.textContent = config.pinchReleaseThreshold.toFixed(3);
  });

  const pokeRadiusSlider = document.getElementById('poke-radius') as HTMLInputElement;
  pokeRadiusSlider.addEventListener('input', () => {
    config.pokeRadius = parseFloat(pokeRadiusSlider.value);
    document.getElementById('poke-radius-value')!.textContent = config.pokeRadius.toFixed(0);
  });

  const impulseSlider = document.getElementById('impulse-strength') as HTMLInputElement;
  impulseSlider.addEventListener('input', () => {
    config.impulseStrength = parseFloat(impulseSlider.value);
    document.getElementById('impulse-strength-value')!.textContent = config.impulseStrength.toFixed(3);
  });

  const spawnDebounceSlider = document.getElementById('spawn-debounce') as HTMLInputElement;
  spawnDebounceSlider.addEventListener('input', () => {
    config.spawnDebounceMs = parseInt(spawnDebounceSlider.value);
    document.getElementById('spawn-debounce-value')!.textContent = config.spawnDebounceMs.toString();
  });

  const ballSizeSlider = document.getElementById('ball-size') as HTMLInputElement;
  ballSizeSlider.addEventListener('input', () => {
    config.ballRadius = parseFloat(ballSizeSlider.value);
    document.getElementById('ball-size-value')!.textContent = config.ballRadius.toFixed(0);
  });
}

function updateDebugDisplay(gestureState: GestureState | null, handDetected: boolean): void {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    document.getElementById('fps-display')!.textContent = currentFps.toString();
    frameCount = 0;
    lastFpsUpdate = now;
  }

  document.getElementById('hand-detected')!.textContent = handDetected ? 'Yes' : 'No';
  document.getElementById('sphere-count')!.textContent = getBalls().length.toString();

  const gestureElement = document.getElementById('gesture-state')!;
  if (!gestureState || !handDetected) {
    gestureElement.textContent = 'IDLE';
    gestureElement.className = 'gesture-state gesture-idle';
  } else {
    gestureElement.textContent = gestureState.type.toUpperCase();
    gestureElement.className = `gesture-state gesture-${gestureState.type}`;
  }

  const pinchDistElement = document.getElementById('pinch-distance')!;
  if (gestureState) {
    pinchDistElement.textContent = gestureState.pinchDistance.toFixed(3);
  } else {
    pinchDistElement.textContent = '-';
  }
}

function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(v: Point2D): Point2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

function handlePokeInteraction(fingerTipData: FingerTipData, timestamp: number): void {
  const balls = getBalls();
  const indexTip = fingerTipData.indexTip;
  const velocity = fingerTipData.velocity;
  const velMag = getVelocityMagnitude(velocity);

  for (const ball of balls) {
    if (ball.isGrabbed) continue;

    const ballPos = getBodyPosition(ball.body);
    const dist = distance(indexTip, ballPos);

    const lastPoke = pokeCooldowns.get(ball) || 0;
    if (timestamp - lastPoke < POKE_COOLDOWN_MS) continue;

    if (dist < config.pokeRadius + config.ballRadius) {
      const direction = normalize({
        x: ballPos.x - indexTip.x,
        y: ballPos.y - indexTip.y,
      });

      // Force magnitude based on velocity
      const forceMag = Math.min(velMag * config.impulseStrength * 0.001, config.maxImpulse);

      if (forceMag > 0.001) {
        applyForce(ball.body, {
          x: direction.x * forceMag,
          y: direction.y * forceMag,
        });
        pokeCooldowns.set(ball, timestamp);
      }
    }
  }
}

function handleGrabInteraction(gestureState: GestureState, fingerTipData: FingerTipData, timestamp: number): void {
  const balls = getBalls();
  const pinchPoint = fingerTipData.pinchPoint;

  if (gestureState.isPinching) {
    if (!grabbedBall) {
      for (const ball of balls) {
        const ballPos = getBodyPosition(ball.body);
        const dist = distance(pinchPoint, ballPos);

        if (dist < config.grabRadius + config.ballRadius) {
          grabbedBall = ball;
          ball.isGrabbed = true;
          setBodyStatic(ball.body, true);
          grabVelocityHistory = [];
          lastGrabPos = { ...pinchPoint };
          lastGrabTime = timestamp;
          break;
        }
      }
    }

    if (grabbedBall) {
      setBodyPosition(grabbedBall.body, pinchPoint);

      // Track velocity using actual time delta
      if (lastGrabPos && lastGrabTime > 0) {
        const dt = (timestamp - lastGrabTime) / 1000; // seconds
        if (dt > 0 && dt < 0.1) { // Only track if reasonable time delta
          const instantVel: Point2D = {
            x: (pinchPoint.x - lastGrabPos.x) / dt,
            y: (pinchPoint.y - lastGrabPos.y) / dt,
          };

          grabVelocityHistory.push(instantVel);
          if (grabVelocityHistory.length > VELOCITY_HISTORY_SIZE) {
            grabVelocityHistory.shift();
          }
        }
      }

      lastGrabPos = { ...pinchPoint };
      lastGrabTime = timestamp;
      setPinchIndicator(pinchPoint, true);
    }
  } else {
    if (grabbedBall) {
      grabbedBall.isGrabbed = false;
      setBodyStatic(grabbedBall.body, false);

      if (grabVelocityHistory.length > 0) {
        // Use weighted average favoring recent velocities
        let totalWeight = 0;
        const avgVel: Point2D = { x: 0, y: 0 };
        for (let i = 0; i < grabVelocityHistory.length; i++) {
          const weight = i + 1; // More recent = higher weight
          avgVel.x += grabVelocityHistory[i].x * weight;
          avgVel.y += grabVelocityHistory[i].y * weight;
          totalWeight += weight;
        }
        avgVel.x /= totalWeight;
        avgVel.y /= totalWeight;

        // Apply throw velocity directly (pixels per second to Matter.js velocity)
        const throwScale = 0.02;
        setBodyVelocity(grabbedBall.body, {
          x: avgVel.x * throwScale,
          y: avgVel.y * throwScale,
        });
      }

      grabbedBall = null;
      grabVelocityHistory = [];
      lastGrabPos = null;
      lastGrabTime = 0;
    }

    setPinchIndicator(null, false);
  }
}

function mainLoop(timestamp: number): void {
  if (!isRunning) return;

  // Detect hands
  const handData = detectHands(video, timestamp);

  let gestureState: GestureState | null = null;
  let fingerTipData: FingerTipData | null = null;
  let screenLandmarks: Point2D[] = [];

  if (handData && handData.landmarks.length > 0) {
    // Convert landmarks to screen coordinates
    screenLandmarks = convertToScreenCoords(handData.landmarks, screenWidth, screenHeight);
    handData.screenLandmarks = screenLandmarks;

    // Analyze gestures
    const analysis = analyzeGestures(
      handData.landmarks,
      screenLandmarks,
      handData.handedness,
      timestamp,
      config
    );
    gestureState = analysis.gestureState;
    fingerTipData = analysis.fingerTipData;

    // Handle spawn
    if (analysis.shouldSpawn) {
      createBall(fingerTipData.pinchPoint, config.ballRadius);
    }

    // Handle interactions
    if (gestureState.type === 'poke') {
      handlePokeInteraction(fingerTipData, timestamp);
      setFingerIndicator(fingerTipData.indexTip, true);
    } else {
      setFingerIndicator(null, false);
    }

    if (gestureState.type === 'grab' || grabbedBall) {
      handleGrabInteraction(gestureState, fingerTipData, timestamp);
    }
  } else {
    setFingerIndicator(null, false);

    if (grabbedBall) {
      grabbedBall.isGrabbed = false;
      setBodyStatic(grabbedBall.body, false);
      grabbedBall = null;
      grabVelocityHistory = [];
      lastGrabPos = null;
      lastGrabTime = 0;
    }
    setPinchIndicator(null, false);
  }

  // Update debug display
  updateDebugDisplay(gestureState, handData !== null);

  // Step physics
  stepPhysics(1000 / 60);

  // Render
  render(config.ballRadius);

  // Draw hand landmarks on top
  if (screenLandmarks.length > 0) {
    drawLandmarks(screenLandmarks);
  }

  requestAnimationFrame(mainLoop);
}

async function init(): Promise<void> {
  video = document.getElementById('webcam') as HTMLVideoElement;
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  await populateCameraSelect();

  const startButton = document.getElementById('start-button')!;
  startButton.addEventListener('click', async () => {
    const select = document.getElementById('camera-select') as HTMLSelectElement;
    selectedCameraId = select.value;

    if (!selectedCameraId) {
      alert('Please select a camera');
      return;
    }

    // Hide camera select, show app UI
    document.getElementById('camera-select-container')!.classList.add('hidden');
    document.getElementById('video-container')!.classList.remove('hidden');
    document.getElementById('game-canvas')!.classList.remove('hidden');
    document.getElementById('debug-panel')!.classList.remove('hidden');
    document.getElementById('controls-panel')!.classList.remove('hidden');
    document.getElementById('instructions')!.classList.remove('hidden');

    console.log('Initializing hand tracking...');
    await initHandTracking();
    console.log('Hand tracking initialized');

    console.log('Initializing physics...');
    initPhysics(screenWidth, screenHeight);
    console.log('Physics initialized');

    console.log('Initializing renderer...');
    initRenderer(canvas);
    resizeRenderer(screenWidth, screenHeight);
    console.log('Renderer initialized');

    setupControlListeners();

    window.addEventListener('resize', handleResize);

    console.log('Starting camera...');
    await startCamera(selectedCameraId);
    console.log('Camera started');

    isRunning = true;
    resetGestureState();
    requestAnimationFrame(mainLoop);
  });
}

init().catch(console.error);
