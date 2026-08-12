# Hand-Tracking 2D Physics

A browser playground that maps MediaPipe hand landmarks into a Matter.js 2D physics world. Hand gestures can spawn balls, poke them, grab them with a pinch, and throw them by releasing with motion.

## Gestures

| Gesture | Action |
|---|---|
| Four fingers extended, thumb folded | Spawn a ball after the debounce interval |
| Index finger extended | Poke nearby balls using fingertip motion |
| Thumb/index pinch | Grab the nearest ball inside the grab radius |
| Release a moving pinch | Throw the held ball using measured release velocity |

Pinch grab and release use separate thresholds to avoid rapid state oscillation. Sliders expose the thresholds, ball radius, poke force, and spawn debounce for calibration.

## Architecture

```text
camera -> MediaPipe Hand Landmarker -> normalized landmarks -> gesture state
                                                        |-> Matter.js forces/body position
Matter.js engine ---------------------------------------+-> canvas renderer
```

- `src/handTracking.ts` initializes the model and converts landmarks to screen coordinates.
- `src/gestures.ts` implements extension, pinch, debounce, and velocity rules.
- `src/physics.ts` owns the Matter.js engine, boundaries, and ball bodies.
- `src/renderer.ts` draws the world and hand indicators on a 2D canvas.
- `src/app.ts` coordinates camera selection, controls, gestures, and animation.

## Run

Requirements: Node.js 18+, a modern browser, and a webcam.

```bash
npm install
npm run dev
```

Grant camera permission, select a camera, and tune the controls for the camera angle and hand distance. Production build:

```bash
npm run build
npm run preview
```

MediaPipe WebAssembly and its hand-landmarker model are downloaded from public Google/CDN URLs at runtime.

## Privacy and limitations

Frames are processed in the browser and are not intentionally saved or uploaded by this application. The external model files still require network access unless self-hosted.

This is 2D interaction, not Three.js or a 3D rigid-body simulation. Gesture quality depends on lighting, occlusion, camera mirroring, hand distance, and inference speed. It supports one detected hand in the current implementation and is not appropriate for safety-critical controls.

## License

Original source is MIT licensed. MediaPipe and Matter.js retain their upstream licenses.
