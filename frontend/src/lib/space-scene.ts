import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  PerspectiveCamera,
  Points,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { consumeSceneStateSnapshot, saveSceneStateSnapshot } from '@/services/scene-transition'

const SETTINGS = {
  particles: 128 ** 2,
  camera: {
    fov: 60,
    near: 0.1,
    far: 100,
    // Reduce camera pitch by lowering Y and aiming slightly above space center.
    position: [0, 1.34, 1.62] as [number, number, number],
    lookAtY: 0.1,
  },
  renderer: {
    clearColor: '#010c16',
  },
  space: {
    branches: 5,
    colors: {
      inner: '#89eeff',
      outer: '#4a5cff',
    },
    mouse: {
      radius: 0.12,
      strength: 0.02,
      twist: 0.017,
      holeStart: 0.46,
      holeEnd: 0.88,
    },
  },
  universe: {
    color: [0.67, 0.38, 0.95] as [number, number, number],
    mouse: {
      radius: 0.14,
      strength: 0.015,
      twist: 0.012,
      holeStart: 0.5,
      holeEnd: 0.9,
    },
  },
  intro: {
    durationMs: 5000,
    radius: 1.618,
    spin: Math.PI * 2,
    randomness: 0.5,
    rotate: Math.PI * 4,
    cameraStartPosition: [0, 1.94, 2.16] as [number, number, number],
  },
  animation: {
    timeStep: 0.001,
    pointerLerp: 0.24,
  },
} as const

const POINTER_MESSAGE_TYPE = 'timecapsule-scene-pointer'
const MOTION_MESSAGE_TYPE = 'timecapsule-scene-motion'
const TRAVEL_MESSAGE_TYPE = 'timecapsule-scene-travel'
const POINTER_OFFSCREEN = 2
const HOVER_TIME_SCALE = 0.46
const HOVER_TIME_SCALE_LERP = 0.08
const HOVER_SPACE_MOUSE_RADIUS_MULT = 1.55
const HOVER_SPACE_MOUSE_STRENGTH_MULT = 1.7
const HOVER_UNIVERSE_MOUSE_RADIUS_MULT = 1.35
const HOVER_UNIVERSE_MOUSE_STRENGTH_MULT = 1.5
const HOVER_MOUSE_UNIFORM_LERP = 0.11
const MOTION_POST_EVERY_N_FRAMES = 2
const TRAVEL_CAMERA_TUNING = {
  orbitRadiusBase: 2.06,
  orbitRadiusByFocusX: 0.1,
  sideOffsetByFocusX: 0.18,
  sideOffsetClamp: 0.22,
  orbitHeightBase: .7,
  orbitHeightByFocusY: 0.1,
  orbitHeightMin: 0.16,
  orbitHeightMax: 3,
  orbitLookOffset: 0.05,
  orbitLookYOffset: 0.024,
  orbitLookYMin: -0.02,
  orbitLookYMax: 0.07,
  zoomPhaseDivisor: 0.76,
  zoomPhasePower: 0.86,
  orbitArcBase: 0.12,
  orbitArcByDistance: 0.08,
  orbitArcMax: 0.24,
  orbitVerticalLift: 0.07,
  orbitLookBlendBase: 0.42,
  orbitLookBlendByPhase: 0.28,
  orbitModeStart: -0.02,
  orbitModeRange: 0.3,
  orbitModeZoomStart: 0.14,
  orbitModeZoomRange: 0.34,
  scrollTiltByFocusY: 1,
  scrollTiltByZoom: 0.08,
  scrollTiltMin: -0.09,
  scrollTiltMax: 3.77,
  scrollCameraLiftByTilt: 0.86,
  focusBoostCameraPush: 0.54,
  centerDiveCameraY: 0.2,
  centerDiveCameraZ: 0.26,
  centerDiveLookY: 0.02,
} as const

type PointerLockState = {
  active: boolean
  x: number
  y: number
}

type PointerRuntimeState = {
  hidden: boolean
}

type PointerMessagePayload =
  | { mode: 'lock'; x: number; y: number }
  | { mode: 'release'; x?: number; y?: number }

type PointerMessage = {
  type: string
  payload?: PointerMessagePayload
}

type TravelMessagePayload =
  | {
    mode: 'start'
    x: number
    y: number
    intensity?: number
    zoom?: number
    focusBoost?: number
    centerDive?: boolean
    centerDiveStrength?: number
    instant?: boolean
    durationMs?: number
  }
  | { mode: 'stop'; instant?: boolean; durationMs?: number }

type TravelMessage = {
  type: string
  payload?: TravelMessagePayload
}

type IntroState = {
  done: boolean
  startMs: number
}

type SpaceMotionPayload = {
  uTime: number
  rotationY: number
  radius: number
  introProgress: number
  introDone: boolean
}

type MountSpaceSceneOptions = {
  restoreSnapshot?: boolean
  startSettled?: boolean
}

type PointerEventsArgs = {
  canvas: HTMLCanvasElement
  pointer: Vector2
  pointerTarget: Vector2
  pointerLockState: PointerLockState
  pointerRuntime: PointerRuntimeState
}

type ResizeHandlerArgs = {
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  materials: RawShaderMaterial[]
}

type IntroAnimationArgs = {
  introState: IntroState
  spaceMaterial: RawShaderMaterial
  spacePoints: Points
  universePoints: Points
  nowMs: number
}

type TravelMotionState = {
  active: boolean
  startMs: number
  durationMs: number
  hideFocusAtEnd: boolean
  fromFocus: Vector2
  toFocus: Vector2
  fromZoom: number
  toZoom: number
  fromIntensity: number
  toIntensity: number
}

const SHADER_UTILS = `
float random (vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 scatter (vec3 seed) {
  float u = random(seed.xy);
  float v = random(seed.yz);
  float theta = u * 6.28318530718;
  float phi = acos(2.0 * v - 1.0);

  float sinTheta = sin(theta);
  float cosTheta = cos(theta);
  float sinPhi = sin(phi);
  float cosPhi = cos(phi);

  float x = sinPhi * cosTheta;
  float y = sinPhi * sinTheta;
  float z = cosPhi;

  return vec3(x, y, z);
}
`

const SPACE_VERTEX_SHADER = `
precision highp float;

attribute vec3 position;
attribute float size;
attribute vec3 seed;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform float uTime;
uniform float uSize;
uniform float uBranches;
uniform float uRadius;
uniform float uSpin;
uniform float uRandomness;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseTwist;
uniform float uMouseVelocity;
uniform float uAspect;
uniform vec2 uTravelFocus;
uniform float uTravelRadius;
uniform float uTravelIntensity;

varying float vDistance;
varying float vMouseInfluence;
varying float vTravelInfluence;

#define PI  3.14159265359
#define PI2 6.28318530718

${SHADER_UTILS}

void main() {
  vec3 p = position;
  float st = sqrt(p.x);
  float qt = p.x * p.x;
  float mt = mix(st, qt, p.x);

  float angle = qt * uSpin * (2.0 - sqrt(1.0 - qt));
  float branchOffset = (PI2 / uBranches) * floor(seed.x * uBranches);
  p.x = position.x * cos(angle + branchOffset) * uRadius;
  p.z = position.x * sin(angle + branchOffset) * uRadius;

  p += scatter(seed) * random(seed.zx) * uRandomness * mt;
  p.y *= 0.5 + qt * 0.5;

  vec3 temp = p;
  float ac = cos(-uTime * (2.0 - st) * 0.5);
  float as = sin(-uTime * (2.0 - st) * 0.5);
  p.x = temp.x * ac - temp.z * as;
  p.z = temp.x * as + temp.z * ac;

  vDistance = mt;

  vec4 mvp = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mvp;
  vec2 ndc = clip.xy / clip.w;
  vec2 mouseDelta = ndc - uMouse;
  mouseDelta.x *= uAspect;

  float distanceToMouse = length(mouseDelta);
  float mouseInfluence = 1.0 - smoothstep(0.0, uMouseRadius, distanceToMouse);
  mouseInfluence = pow(mouseInfluence, 1.8);

  vec2 travelDelta = ndc - uTravelFocus;
  travelDelta.x *= uAspect;
  float travelDistance = length(travelDelta);
  float travelInfluence = 1.0 - smoothstep(0.0, uTravelRadius, travelDistance);
  travelInfluence = pow(travelInfluence, 1.55) * uTravelIntensity;

  vec2 pushDir = distanceToMouse > 0.00001 ? mouseDelta / distanceToMouse : vec2(0.0);
  vec2 ndcPushDir = vec2(pushDir.x / uAspect, pushDir.y);
  vec2 tangentDir = vec2(-pushDir.y, pushDir.x);
  vec2 ndcTangentDir = vec2(tangentDir.x / uAspect, tangentDir.y);
  float swirlInfluence = mouseInfluence * (1.0 - smoothstep(0.0, uMouseRadius * 0.86, distanceToMouse));
  float velocityBoost = 0.62 + clamp(uMouseVelocity * 280.0, 0.0, 1.28);
  float ripple = sin(distanceToMouse * 56.0 - uTime * 8.6);
  clip.xy += ndcPushDir * mouseInfluence * uMouseStrength * clip.w;
  clip.xy += ndcTangentDir * swirlInfluence * uMouseTwist * velocityBoost * clip.w;
  clip.xy += ndcPushDir * ripple * swirlInfluence * (uMouseStrength * 0.52) * clip.w;

  gl_Position = clip;
  gl_PointSize = (10.0 * size * uSize) / -mvp.z;
  gl_PointSize *= 1.0 + mouseInfluence * 0.18 + travelInfluence * 0.34;

  vMouseInfluence = mouseInfluence;
  vTravelInfluence = travelInfluence;
}
`

const SPACE_FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uColorInn;
uniform vec3 uColorOut;
uniform sampler2D uAlphaMap;
uniform float uHoleStart;
uniform float uHoleEnd;

varying float vDistance;
varying float vMouseInfluence;
varying float vTravelInfluence;

#define PI  3.14159265359

void main() {
  vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  float a = texture2D(uAlphaMap, uv).g;
  if (a < 0.1) discard;

  vec3 color = mix(uColorInn, uColorOut, vDistance);
  float c = step(0.99, (sin(gl_PointCoord.x * PI) + sin(gl_PointCoord.y * PI)) * 0.5);
  vec3 sparkle = vec3(c * 0.82, c * 0.48, c);
  vec3 violetTint = vec3(0.76, 0.36, 0.94);
  float core = 1.0 - smoothstep(0.0, 0.46, vDistance);
  float coreBoost = pow(core, 1.9);
  color = mix(color, violetTint, smoothstep(0.58, 1.0, vDistance) * 0.42);
  color += vec3(0.82, 0.97, 1.08) * coreBoost * 1.5;
  color *= mix(0.62, 1.08, core);
  color += vec3(0.46, 0.78, 1.0) * vTravelInfluence * 1.35;
  color = max(color, sparkle);

  float holeMask = 1.0 - smoothstep(uHoleStart, uHoleEnd, vMouseInfluence);
  a *= holeMask;
  if (a < 0.02) discard;

  a *= mix(0.72, 1.16, core);
  a = min(1.0, a * (1.0 + vTravelInfluence * 0.42));
  gl_FragColor = vec4(color, a);
}
`

const UNIVERSE_VERTEX_SHADER = `
precision highp float;

attribute vec3 seed;
attribute float size;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform float uTime;
uniform float uSize;
uniform float uRadius;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseTwist;
uniform float uMouseVelocity;
uniform float uAspect;
uniform vec2 uTravelFocus;
uniform float uTravelRadius;
uniform float uTravelIntensity;

varying float vMouseInfluence;
varying float vTravelInfluence;

#define PI  3.14159265359
#define PI2 6.28318530718

${SHADER_UTILS}

const float r = 3.0;
const vec3 s = vec3(2.1, 1.3, 2.1);

void main() {
  vec3 p = scatter(seed) * r * s;

  float q = random(seed.zx);
  for (int i = 0; i < 3; i++) q *= q;
  p *= q;

  float l = length(p) / (s.x * r);
  p = l < 0.001 ? (p / l) : p;

  vec3 temp = p;
  float ql = 1.0 - l;
  for (int i = 0; i < 3; i++) ql *= ql;
  float ac = cos(-uTime * ql);
  float as = sin(-uTime * ql);
  p.x = temp.x * ac - temp.z * as;
  p.z = temp.x * as + temp.z * ac;

  vec4 mvp = modelViewMatrix * vec4(p * uRadius, 1.0);
  vec4 clip = projectionMatrix * mvp;
  vec2 ndc = clip.xy / clip.w;
  vec2 mouseDelta = ndc - uMouse;
  mouseDelta.x *= uAspect;

  float distanceToMouse = length(mouseDelta);
  float mouseInfluence = 1.0 - smoothstep(0.0, uMouseRadius, distanceToMouse);
  mouseInfluence = pow(mouseInfluence, 1.8);

  vec2 travelDelta = ndc - uTravelFocus;
  travelDelta.x *= uAspect;
  float travelDistance = length(travelDelta);
  float travelInfluence = 1.0 - smoothstep(0.0, uTravelRadius, travelDistance);
  travelInfluence = pow(travelInfluence, 1.5) * uTravelIntensity;

  vec2 pushDir = distanceToMouse > 0.00001 ? mouseDelta / distanceToMouse : vec2(0.0);
  vec2 ndcPushDir = vec2(pushDir.x / uAspect, pushDir.y);
  vec2 tangentDir = vec2(-pushDir.y, pushDir.x);
  vec2 ndcTangentDir = vec2(tangentDir.x / uAspect, tangentDir.y);
  float swirlInfluence = mouseInfluence * (1.0 - smoothstep(0.0, uMouseRadius * 0.9, distanceToMouse));
  float velocityBoost = 0.58 + clamp(uMouseVelocity * 230.0, 0.0, 1.18);
  float ripple = sin(distanceToMouse * 44.0 - uTime * 7.2);
  clip.xy += ndcPushDir * mouseInfluence * uMouseStrength * clip.w;
  clip.xy += ndcTangentDir * swirlInfluence * uMouseTwist * velocityBoost * clip.w;
  clip.xy += ndcPushDir * ripple * swirlInfluence * (uMouseStrength * 0.38) * clip.w;

  gl_Position = clip;

  l = (2.0 - l) * (2.0 - l);
  gl_PointSize = (r * size * uSize * l) / -mvp.z;
  gl_PointSize *= 1.0 + mouseInfluence * 0.1 + travelInfluence * 0.24;

  vMouseInfluence = mouseInfluence;
  vTravelInfluence = travelInfluence;
}
`

const UNIVERSE_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uAlphaMap;
uniform vec3 uColor;
uniform float uHoleStart;
uniform float uHoleEnd;

varying float vMouseInfluence;
varying float vTravelInfluence;

void main() {
  vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  float a = texture2D(uAlphaMap, uv).g;
  if (a < 0.1) discard;

  float holeMask = 1.0 - smoothstep(uHoleStart, uHoleEnd, vMouseInfluence);
  a *= holeMask;
  if (a < 0.02) discard;

  vec3 color = uColor + vec3(0.35, 0.66, 0.98) * vTravelInfluence * 0.95;
  a = min(1.0, a * (1.0 + vTravelInfluence * 0.2));
  gl_FragColor = vec4(color, a);
}
`

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

function easeInOutCubic(t: number): number {
  if (t < 0.5) return 4 * t * t * t
  return 1 - Math.pow(-2 * t + 2, 3) / 2
}

function smoothStep01(t: number): number {
  const clamped = clamp(t, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

function getAspect(): number {
  return window.innerWidth / window.innerHeight
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    SETTINGS.camera.fov,
    getAspect(),
    SETTINGS.camera.near,
    SETTINGS.camera.far,
  )
  camera.position.set(...SETTINGS.camera.position)
  camera.lookAt(0, SETTINGS.camera.lookAtY, 0)
  return camera
}

function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(SETTINGS.renderer.clearColor, 1)
  return renderer
}

function createAlphaMapTexture(): CanvasTexture {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) {
    throw new Error('Unable to create 2D context for alpha texture')
  }

  context.canvas.width = context.canvas.height = 32
  context.fillStyle = '#000'
  context.fillRect(0, 0, 32, 32)

  let gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0.0, '#fff')
  gradient.addColorStop(1.0, '#000')
  context.fillStyle = gradient
  context.beginPath()
  context.rect(15, 0, 2, 32)
  context.fill()
  context.beginPath()
  context.rect(0, 15, 32, 2)
  context.fill()

  gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0.1, '#ffff')
  gradient.addColorStop(0.6, '#0000')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)

  return new CanvasTexture(context.canvas)
}

function createSpaceGeometry(count: number): BufferGeometry {
  const geometry = new BufferGeometry()
  const position = new Float32Array(count * 3)
  const seed = new Float32Array(count * 3)
  const size = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    position[index * 3] = index / count
    seed[index * 3] = Math.random()
    seed[index * 3 + 1] = Math.random()
    seed[index * 3 + 2] = Math.random()
    size[index] = Math.random() * 2 + 0.5
  }

  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('seed', new BufferAttribute(seed, 3))
  geometry.setAttribute('size', new BufferAttribute(size, 1))
  return geometry
}

function createUniverseGeometry(count: number): BufferGeometry {
  const pointCount = Math.floor(count / 2)
  const geometry = new BufferGeometry()
  const position = new Float32Array(pointCount * 3)
  const seed = new Float32Array(pointCount * 3)
  const size = new Float32Array(pointCount)

  for (let index = 0; index < pointCount; index += 1) {
    seed[index * 3] = Math.random()
    seed[index * 3 + 1] = Math.random()
    seed[index * 3 + 2] = Math.random()
    size[index] = Math.random() * 2 + 0.5
  }

  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('seed', new BufferAttribute(seed, 3))
  geometry.setAttribute('size', new BufferAttribute(size, 1))
  return geometry
}

function createSpaceMaterial(args: {
  alphaMap: CanvasTexture
  pixelRatio: number
  pointer: Vector2
}): RawShaderMaterial {
  const innerColor = new Color(SETTINGS.space.colors.inner)
  const outerColor = new Color(SETTINGS.space.colors.outer)

  return new RawShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: args.pixelRatio },
      uBranches: { value: SETTINGS.space.branches },
      uRadius: { value: 0 },
      uSpin: { value: 0 },
      uRandomness: { value: 0 },
      uMouse: { value: args.pointer.clone() },
      uMouseRadius: { value: SETTINGS.space.mouse.radius },
      uMouseStrength: { value: SETTINGS.space.mouse.strength },
      uMouseTwist: { value: SETTINGS.space.mouse.twist },
      uMouseVelocity: { value: 0 },
      uAspect: { value: getAspect() },
      uTravelFocus: { value: new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN) },
      uTravelRadius: { value: 0.17 },
      uTravelIntensity: { value: 0 },
      uHoleStart: { value: SETTINGS.space.mouse.holeStart },
      uHoleEnd: { value: SETTINGS.space.mouse.holeEnd },
      uAlphaMap: { value: args.alphaMap },
      uColorInn: { value: innerColor },
      uColorOut: { value: outerColor },
    },
    vertexShader: SPACE_VERTEX_SHADER,
    fragmentShader: SPACE_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

function createUniverseMaterial(args: {
  alphaMap: CanvasTexture
  pixelRatio: number
  radiusUniform: { value: number }
  pointer: Vector2
}): RawShaderMaterial {
  return new RawShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: args.pixelRatio },
      uRadius: args.radiusUniform,
      uMouse: { value: args.pointer.clone() },
      uMouseRadius: { value: SETTINGS.universe.mouse.radius },
      uMouseStrength: { value: SETTINGS.universe.mouse.strength },
      uMouseTwist: { value: SETTINGS.universe.mouse.twist },
      uMouseVelocity: { value: 0 },
      uAspect: { value: getAspect() },
      uTravelFocus: { value: new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN) },
      uTravelRadius: { value: 0.17 },
      uTravelIntensity: { value: 0 },
      uHoleStart: { value: SETTINGS.universe.mouse.holeStart },
      uHoleEnd: { value: SETTINGS.universe.mouse.holeEnd },
      uAlphaMap: { value: args.alphaMap },
      uColor: { value: SETTINGS.universe.color },
    },
    vertexShader: UNIVERSE_VERTEX_SHADER,
    fragmentShader: UNIVERSE_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

function hidePointer(pointer: Vector2, pointerTarget: Vector2, pointerRuntime: PointerRuntimeState): void {
  pointer.set(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  pointerTarget.set(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  pointerRuntime.hidden = true
}

function attachPointerEvents({
  canvas,
  pointer,
  pointerTarget,
  pointerLockState,
  pointerRuntime,
}: PointerEventsArgs): () => void {
  const isInsideCanvas = (event: PointerEvent): boolean => {
    const rect = canvas.getBoundingClientRect()
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    )
  }

  const updatePointerTarget = (event: PointerEvent): void => {
    if (pointerLockState.active) return
    if (!isInsideCanvas(event)) {
      hidePointer(pointer, pointerTarget, pointerRuntime)
      return
    }
    const rect = canvas.getBoundingClientRect()
    const nextX = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const nextY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    if (pointerRuntime.hidden) {
      pointer.set(nextX, nextY)
      pointerRuntime.hidden = false
    }
    pointerTarget.set(nextX, nextY)
  }

  const onPointerLeaveWindow = (): void => {
    if (pointerLockState.active) return
    hidePointer(pointer, pointerTarget, pointerRuntime)
  }

  const onBlur = (): void => {
    if (pointerLockState.active) return
    hidePointer(pointer, pointerTarget, pointerRuntime)
  }

  const onVisibilityChange = (): void => {
    if (document.hidden && !pointerLockState.active) {
      hidePointer(pointer, pointerTarget, pointerRuntime)
    }
  }

  window.addEventListener('pointermove', updatePointerTarget, { passive: true })
  window.addEventListener('pointerdown', updatePointerTarget, { passive: true })
  window.addEventListener('pointerleave', onPointerLeaveWindow)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('pointermove', updatePointerTarget)
    window.removeEventListener('pointerdown', updatePointerTarget)
    window.removeEventListener('pointerleave', onPointerLeaveWindow)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

function attachResizeHandler({ camera, renderer, materials }: ResizeHandlerArgs): () => void {
  const onResize = (): void => {
    const aspect = getAspect()
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)

    const pixelRatio = renderer.getPixelRatio()
    materials.forEach((material) => {
      material.uniforms.uSize.value = pixelRatio
      material.uniforms.uAspect.value = aspect
    })
  }

  window.addEventListener('resize', onResize)
  return () => {
    window.removeEventListener('resize', onResize)
  }
}

function updateIntroAnimation({
  introState,
  spaceMaterial,
  spacePoints,
  universePoints,
  nowMs,
}: IntroAnimationArgs): number {
  if (introState.done) return 1

  const progress = clamp((nowMs - introState.startMs) / SETTINGS.intro.durationMs, 0, 1)
  const easedProgress = easeInOutCubic(progress)

  spaceMaterial.uniforms.uRadius.value = lerp(0, SETTINGS.intro.radius, easedProgress)
  spaceMaterial.uniforms.uSpin.value = lerp(0, SETTINGS.intro.spin, easedProgress)
  spaceMaterial.uniforms.uRandomness.value = lerp(0, SETTINGS.intro.randomness, easedProgress)

  const rotation = lerp(0, SETTINGS.intro.rotate, easedProgress)
  spacePoints.rotation.y = rotation
  universePoints.rotation.y = rotation / 3

  if (progress >= 1) {
    introState.done = true
  }

  return easedProgress
}

function parsePointerMessage(event: MessageEvent): PointerMessagePayload | null {
  const data = event.data as PointerMessage | null
  if (!data || typeof data !== 'object') return null
  if (data.type !== POINTER_MESSAGE_TYPE) return null
  const payload = data.payload
  if (!payload || typeof payload !== 'object') return null
  return payload
}

function parseTravelMessage(event: MessageEvent): TravelMessagePayload | null {
  const data = event.data as TravelMessage | null
  if (!data || typeof data !== 'object') return null
  if (data.type !== TRAVEL_MESSAGE_TYPE) return null
  const payload = data.payload
  if (!payload || typeof payload !== 'object') return null
  return payload
}

function createMotionPayload(args: {
  spaceMaterial: RawShaderMaterial
  spacePoints: Points
  introState: IntroState
}): SpaceMotionPayload {
  const radius = args.spaceMaterial.uniforms.uRadius.value
  return {
    uTime: args.spaceMaterial.uniforms.uTime.value,
    rotationY: args.spacePoints.rotation.y,
    radius,
    introProgress: Math.min(1, radius / SETTINGS.intro.radius),
    introDone: args.introState.done,
  }
}

export function mountSpaceScene(
  canvas: HTMLCanvasElement,
  options: MountSpaceSceneOptions = {},
): () => void {
  const shouldRestoreSnapshot = options.restoreSnapshot !== false
  const shouldStartSettled = options.startSettled === true
  const pointer = new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  const pointerTarget = new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  const pointerPrevious = new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  const pointerLockState: PointerLockState = {
    active: false,
    x: POINTER_OFFSCREEN,
    y: POINTER_OFFSCREEN,
  }
  const pointerRuntime: PointerRuntimeState = {
    hidden: true,
  }
  const snapshotCandidate = consumeSceneStateSnapshot()
  const restoredSceneSnapshot = shouldRestoreSnapshot ? snapshotCandidate : null
  const introState: IntroState = {
    done: Boolean(restoredSceneSnapshot?.introDone) || shouldStartSettled,
    startMs: performance.now(),
  }

  let motionFrame = 0
  let motionTimeScale = 1
  let mouseVelocityCurrent = 0
  let spaceMouseRadiusCurrent = SETTINGS.space.mouse.radius
  let spaceMouseStrengthCurrent = SETTINGS.space.mouse.strength
  let universeMouseRadiusCurrent = SETTINGS.universe.mouse.radius
  let universeMouseStrengthCurrent = SETTINGS.universe.mouse.strength
  const travelFocusCurrent = new Vector2(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
  let travelIntensityCurrent = 0
  let travelZoomCurrent = 0
  let travelFocusBoostCurrent = 0
  let travelCenterDiveCurrent = 0
  let travelCenterDivePrimed = false
  const travelMotion: TravelMotionState = {
    active: false,
    startMs: 0,
    durationMs: 1,
    hideFocusAtEnd: false,
    fromFocus: travelFocusCurrent.clone(),
    toFocus: travelFocusCurrent.clone(),
    fromZoom: 0,
    toZoom: 0,
    fromIntensity: 0,
    toIntensity: 0,
  }
  const lookTargetCurrent = new Vector3(0, SETTINGS.camera.lookAtY, 0)
  const baseLookTarget = new Vector3(0, SETTINGS.camera.lookAtY, 0)
  const baseCameraPosition = {
    x: SETTINGS.camera.position[0],
    y: SETTINGS.camera.position[1],
    z: SETTINGS.camera.position[2],
  }
  const introCameraStartPosition = {
    x: SETTINGS.intro.cameraStartPosition[0],
    y: SETTINGS.intro.cameraStartPosition[1],
    z: SETTINGS.intro.cameraStartPosition[2],
  }
  let introCameraProgressCurrent = introState.done ? 1 : 0

  const scene = new Scene()
  const camera = createCamera()
  const renderer = createRenderer(canvas)
  const alphaMap = createAlphaMapTexture()
  const travelLegacyPath = new Vector3(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z)
  const travelLegacyLook = new Vector3(0, 0, 0)
  const travelOrbitPath = new Vector3(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z)
  const travelOrbitLook = new Vector3(0, 0, 0)
  const tempCameraStart = new Vector3(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z)
  const tempSamplePoint = new Vector3()
  const tempDirection = new Vector3()
  const tempMarkerDirection = new Vector3()
  const stableMarkerDirection = new Vector3(0, 0, 1)
  const tempTangentDirection = new Vector3()
  const tempFocusBoostDirection = new Vector3()
  const centerDiveCameraFrom = new Vector3()
  const centerDiveLookFrom = new Vector3()

  const getCurrentBaseCameraPosition = (): { x: number; y: number; z: number } => ({
    x: lerp(introCameraStartPosition.x, baseCameraPosition.x, introCameraProgressCurrent),
    y: lerp(introCameraStartPosition.y, baseCameraPosition.y, introCameraProgressCurrent),
    z: lerp(introCameraStartPosition.z, baseCameraPosition.z, introCameraProgressCurrent),
  })

  const computeTravelPath = (focusNdc: Vector2): void => {
    const clampedFocusX = clamp(focusNdc.x, -0.86, 0.86)
    const clampedFocusY = clamp(focusNdc.y, -0.78, 0.78)
    const cameraBase = getCurrentBaseCameraPosition()
    tempCameraStart.set(cameraBase.x, cameraBase.y, cameraBase.z)
    camera.position.copy(tempCameraStart)
    camera.lookAt(baseLookTarget)
    camera.updateMatrixWorld(true)

    tempSamplePoint.set(clampedFocusX, clampedFocusY, 0.5).unproject(camera)
    tempDirection.copy(tempSamplePoint).sub(tempCameraStart).normalize()

    let legacyDistance = 2.45
    if (Math.abs(tempDirection.y) > 0.0001) {
      const t = (0 - tempCameraStart.y) / tempDirection.y
      if (t > 0.1) {
        legacyDistance = clamp(t - 0.28, 1.2, 4.2)
      }
    }

    travelLegacyPath.copy(tempCameraStart).addScaledVector(tempDirection, legacyDistance)
    travelLegacyLook.copy(tempCameraStart).addScaledVector(tempDirection, legacyDistance + 0.52)

    tempMarkerDirection.set(travelLegacyLook.x, 0, travelLegacyLook.z)
    if (tempMarkerDirection.lengthSq() < 0.0001) {
      tempMarkerDirection.copy(stableMarkerDirection)
    } else {
      tempMarkerDirection.normalize()
      stableMarkerDirection.copy(tempMarkerDirection)
    }
    tempTangentDirection.set(-tempMarkerDirection.z, 0, tempMarkerDirection.x)

    const orbitRadius = TRAVEL_CAMERA_TUNING.orbitRadiusBase + Math.abs(clampedFocusX) * TRAVEL_CAMERA_TUNING.orbitRadiusByFocusX
    const sideOffset = clamp(
      clampedFocusX * TRAVEL_CAMERA_TUNING.sideOffsetByFocusX,
      -TRAVEL_CAMERA_TUNING.sideOffsetClamp,
      TRAVEL_CAMERA_TUNING.sideOffsetClamp,
    )
    travelOrbitPath.copy(tempMarkerDirection).multiplyScalar(orbitRadius).addScaledVector(tempTangentDirection, sideOffset)
    travelOrbitPath.y = clamp(
      TRAVEL_CAMERA_TUNING.orbitHeightBase + clampedFocusY * TRAVEL_CAMERA_TUNING.orbitHeightByFocusY,
      TRAVEL_CAMERA_TUNING.orbitHeightMin,
      TRAVEL_CAMERA_TUNING.orbitHeightMax,
    )

    travelOrbitLook.set(
      tempMarkerDirection.x * TRAVEL_CAMERA_TUNING.orbitLookOffset,
      clamp(
        clampedFocusY * TRAVEL_CAMERA_TUNING.orbitLookYOffset,
        TRAVEL_CAMERA_TUNING.orbitLookYMin,
        TRAVEL_CAMERA_TUNING.orbitLookYMax,
      ),
      tempMarkerDirection.z * TRAVEL_CAMERA_TUNING.orbitLookOffset,
    )
  }

  const applyTravelCamera = (): void => {
    const cameraBase = getCurrentBaseCameraPosition()
    const hasTravelTilt = travelZoomCurrent > 0.01 || travelIntensityCurrent > 0.01
    const focusTiltSource = hasTravelTilt ? travelFocusCurrent.y : 0
    const zoomTiltSource = hasTravelTilt ? travelZoomCurrent : 0
    const tiltRaw = focusTiltSource * TRAVEL_CAMERA_TUNING.scrollTiltByFocusY
      + zoomTiltSource * TRAVEL_CAMERA_TUNING.scrollTiltByZoom
    const diveTiltRaw = tiltRaw * 0.18 - 0.12
    const blendedTilt = lerp(tiltRaw, diveTiltRaw, travelCenterDiveCurrent)
    const scrollTilt = clamp(blendedTilt, TRAVEL_CAMERA_TUNING.scrollTiltMin, TRAVEL_CAMERA_TUNING.scrollTiltMax)
    const lookBaseY = baseLookTarget.y + scrollTilt

    const legacyX = lerp(cameraBase.x, travelLegacyPath.x, travelZoomCurrent)
    const legacyY = lerp(cameraBase.y, travelLegacyPath.y, travelZoomCurrent)
    const legacyZ = lerp(cameraBase.z, travelLegacyPath.z, travelZoomCurrent)
    const legacyLookX = lerp(baseLookTarget.x, travelLegacyLook.x, travelZoomCurrent)
    const legacyLookY = lerp(lookBaseY, travelLegacyLook.y, travelZoomCurrent)
    const legacyLookZ = lerp(baseLookTarget.z, travelLegacyLook.z, travelZoomCurrent)

    if (travelCenterDiveCurrent > 0.0001) {
      const t = clamp(travelCenterDiveCurrent, 0, 1)
      const centerTargetCameraX = 0
      const centerTargetCameraY = TRAVEL_CAMERA_TUNING.centerDiveCameraY
      const centerTargetCameraZ = TRAVEL_CAMERA_TUNING.centerDiveCameraZ
      const centerTargetLookX = 0
      const centerTargetLookY = TRAVEL_CAMERA_TUNING.centerDiveLookY
      const centerTargetLookZ = 0
      camera.position.set(
        lerp(centerDiveCameraFrom.x, centerTargetCameraX, t),
        lerp(centerDiveCameraFrom.y, centerTargetCameraY, t),
        lerp(centerDiveCameraFrom.z, centerTargetCameraZ, t),
      )
      lookTargetCurrent.set(
        lerp(centerDiveLookFrom.x, centerTargetLookX, t),
        lerp(centerDiveLookFrom.y, centerTargetLookY, t),
        lerp(centerDiveLookFrom.z, centerTargetLookZ, t),
      )
      camera.lookAt(lookTargetCurrent)
      return
    }

    const normalizedZoom = smoothStep01(clamp(travelZoomCurrent / TRAVEL_CAMERA_TUNING.zoomPhaseDivisor, 0, 1))
    const phaseInput = Math.pow(normalizedZoom, TRAVEL_CAMERA_TUNING.zoomPhasePower)
    const phase = smoothStep01(phaseInput)
    const linearX = lerp(cameraBase.x, travelOrbitPath.x, phase)
    const linearY = lerp(cameraBase.y, travelOrbitPath.y, phase)
    const linearZ = lerp(cameraBase.z, travelOrbitPath.z, phase)
    const deltaX = travelOrbitPath.x - cameraBase.x
    const deltaZ = travelOrbitPath.z - cameraBase.z
    const deltaLength = Math.hypot(deltaX, deltaZ)

    let arcX = 0
    let arcZ = 0
    if (deltaLength > 0.0001) {
      const dirX = deltaX / deltaLength
      const dirZ = deltaZ / deltaLength
      const perpX = -dirZ
      const perpZ = dirX
      const arcAmplitude = Math.sin(Math.PI * phase) * Math.min(
        TRAVEL_CAMERA_TUNING.orbitArcMax,
        TRAVEL_CAMERA_TUNING.orbitArcBase + deltaLength * TRAVEL_CAMERA_TUNING.orbitArcByDistance,
      )
      arcX = perpX * arcAmplitude
      arcZ = perpZ * arcAmplitude
    }

    const orbitX = linearX + arcX
    const orbitY = linearY + Math.sin(Math.PI * phase) * TRAVEL_CAMERA_TUNING.orbitVerticalLift
    const orbitZ = linearZ + arcZ
    const lookBlend = TRAVEL_CAMERA_TUNING.orbitLookBlendBase + phase * TRAVEL_CAMERA_TUNING.orbitLookBlendByPhase
    const orbitLookX = lerp(baseLookTarget.x, travelOrbitLook.x, lookBlend)
    const orbitLookY = lerp(lookBaseY, travelOrbitLook.y, lookBlend)
    const orbitLookZ = lerp(baseLookTarget.z, travelOrbitLook.z, lookBlend)

    const intensityOrbitMode = smoothStep01(
      (travelIntensityCurrent - TRAVEL_CAMERA_TUNING.orbitModeStart) / TRAVEL_CAMERA_TUNING.orbitModeRange,
    )
    const zoomOrbitMode = smoothStep01(
      (travelZoomCurrent - TRAVEL_CAMERA_TUNING.orbitModeZoomStart) / TRAVEL_CAMERA_TUNING.orbitModeZoomRange,
    )
    const baseOrbitMode = Math.max(intensityOrbitMode, zoomOrbitMode)
    const orbitMode = lerp(baseOrbitMode, baseOrbitMode * 0.08, travelCenterDiveCurrent)
    const markerLock = smoothStep01(travelFocusBoostCurrent)
    const pitchLift = scrollTilt * TRAVEL_CAMERA_TUNING.scrollCameraLiftByTilt
    const mixedX = lerp(lerp(legacyX, orbitX, orbitMode), travelLegacyPath.x, markerLock * 0.52)
    const mixedY = lerp(lerp(legacyY, orbitY, orbitMode), travelLegacyPath.y, markerLock * 0.52)
    const mixedZ = lerp(lerp(legacyZ, orbitZ, orbitMode), travelLegacyPath.z, markerLock * 0.52)
    camera.position.set(
      mixedX,
      mixedY + pitchLift,
      mixedZ,
    )
    lookTargetCurrent.set(
      lerp(legacyLookX, orbitLookX, orbitMode),
      lerp(legacyLookY, orbitLookY, orbitMode),
      lerp(legacyLookZ, orbitLookZ, orbitMode),
    )
    if (markerLock > 0.0001) {
      lookTargetCurrent.lerp(travelLegacyLook, markerLock * 0.9)
    }
    if (travelFocusBoostCurrent > 0.0001) {
      tempFocusBoostDirection.copy(lookTargetCurrent).sub(camera.position)
      if (tempFocusBoostDirection.lengthSq() > 0.000001) {
        tempFocusBoostDirection.normalize()
        camera.position.addScaledVector(
          tempFocusBoostDirection,
          travelFocusBoostCurrent * TRAVEL_CAMERA_TUNING.focusBoostCameraPush,
        )
      }
    }
    camera.lookAt(lookTargetCurrent)
  }

  const startTravelMotion = (args: {
    toFocus: Vector2
    toZoom: number
    toIntensity: number
    durationMs: number
    hideFocusAtEnd: boolean
  }): void => {
    travelMotion.active = true
    travelMotion.startMs = performance.now()
    travelMotion.durationMs = Math.max(16, args.durationMs)
    travelMotion.hideFocusAtEnd = args.hideFocusAtEnd
    travelMotion.fromFocus.copy(travelFocusCurrent)
    travelMotion.toFocus.copy(args.toFocus)
    travelMotion.fromZoom = travelZoomCurrent
    travelMotion.toZoom = args.toZoom
    travelMotion.fromIntensity = travelIntensityCurrent
    travelMotion.toIntensity = args.toIntensity
  }

  const spaceGeometry = createSpaceGeometry(SETTINGS.particles)
  const spaceMaterial = createSpaceMaterial({
    alphaMap,
    pixelRatio: renderer.getPixelRatio(),
    pointer,
  })
  const spacePoints = new Points(spaceGeometry, spaceMaterial)

  const universeGeometry = createUniverseGeometry(SETTINGS.particles)
  const universeMaterial = createUniverseMaterial({
    alphaMap,
    pixelRatio: renderer.getPixelRatio(),
    radiusUniform: spaceMaterial.uniforms.uRadius,
    pointer,
  })
  const universePoints = new Points(universeGeometry, universeMaterial)

  if (restoredSceneSnapshot) {
    const restoredRadius = clamp(restoredSceneSnapshot.radius, 0, SETTINGS.intro.radius)
    const restoredTime = Math.max(0, restoredSceneSnapshot.uTime)
    const restoredRotation = restoredSceneSnapshot.rotationY

    spaceMaterial.uniforms.uRadius.value = restoredRadius
    spaceMaterial.uniforms.uSpin.value = SETTINGS.intro.spin
    spaceMaterial.uniforms.uRandomness.value = SETTINGS.intro.randomness
    spaceMaterial.uniforms.uTime.value = restoredTime
    universeMaterial.uniforms.uTime.value = restoredTime * (2 / 3)

    spacePoints.rotation.y = restoredRotation
    universePoints.rotation.y = restoredRotation / 3
  } else if (shouldStartSettled) {
    const settledRotation = SETTINGS.intro.rotate * 0.32
    const settledTime = 18

    spaceMaterial.uniforms.uRadius.value = SETTINGS.intro.radius
    spaceMaterial.uniforms.uSpin.value = SETTINGS.intro.spin
    spaceMaterial.uniforms.uRandomness.value = SETTINGS.intro.randomness
    spaceMaterial.uniforms.uTime.value = settledTime
    universeMaterial.uniforms.uTime.value = settledTime * (2 / 3)

    spacePoints.rotation.y = settledRotation
    universePoints.rotation.y = settledRotation / 3
  }

  scene.add(spacePoints)
  scene.add(universePoints)

  const onPointerMessage = (event: MessageEvent): void => {
    const payload = parsePointerMessage(event)
    if (!payload) return

    if (payload.mode === 'lock') {
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return
      pointerLockState.active = true
      pointerLockState.x = payload.x
      pointerLockState.y = payload.y
      pointerRuntime.hidden = false
      pointer.set(pointerLockState.x, pointerLockState.y)
      pointerTarget.set(pointerLockState.x, pointerLockState.y)
      return
    }

    if (payload.mode === 'release') {
      pointerLockState.active = false
      if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
        pointerRuntime.hidden = false
        pointer.set(payload.x, payload.y)
        pointerTarget.set(payload.x, payload.y)
      } else {
        hidePointer(pointer, pointerTarget, pointerRuntime)
      }
    }
  }

  const onTravelMessage = (event: MessageEvent): void => {
    const payload = parseTravelMessage(event)
    if (!payload) return

    if (payload.mode === 'start') {
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return
      const targetFocus = new Vector2(payload.x, payload.y)
      const targetIntensity = Number.isFinite(payload.intensity) ? payload.intensity : 1
      const targetZoom = clamp(Number.isFinite(payload.zoom) ? payload.zoom : 0.9, 0, 1.25)
      const targetFocusBoost = 0
      const explicitDiveStrength = Number.isFinite(payload.centerDiveStrength)
        ? clamp(payload.centerDiveStrength as number, 0, 1)
        : null
      const nextCenterDiveStrength = explicitDiveStrength ?? (payload.centerDive ? 1 : 0)
      if (nextCenterDiveStrength > 0.0001 && !travelCenterDivePrimed) {
        centerDiveCameraFrom.copy(camera.position)
        centerDiveLookFrom.copy(lookTargetCurrent)
        travelCenterDivePrimed = true
      }
      if (nextCenterDiveStrength <= 0.0001) {
        travelCenterDivePrimed = false
      }
      travelCenterDiveCurrent = nextCenterDiveStrength
      computeTravelPath(targetFocus)
      if (payload.instant) {
        travelMotion.active = false
        travelFocusCurrent.copy(targetFocus)
        travelIntensityCurrent = targetIntensity
        travelZoomCurrent = targetZoom
        travelFocusBoostCurrent = targetFocusBoost
        applyTravelCamera()
      } else {
        // Keep focus fixed on the selected star; animate only zoom/intensity over time.
        travelFocusCurrent.copy(targetFocus)
        travelFocusBoostCurrent = targetFocusBoost
        startTravelMotion({
          toFocus: targetFocus,
          toZoom: targetZoom,
          toIntensity: targetIntensity,
          durationMs: Number.isFinite(payload.durationMs) ? payload.durationMs : 2400,
          hideFocusAtEnd: false,
        })
      }
      return
    }

    if (payload.mode === 'stop') {
      travelCenterDiveCurrent = 0
      travelCenterDivePrimed = false
      if (payload.instant) {
        travelMotion.active = false
        travelIntensityCurrent = 0
        travelZoomCurrent = 0
        travelFocusBoostCurrent = 0
        travelFocusCurrent.set(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
        applyTravelCamera()
      } else {
        travelFocusBoostCurrent = 0
        startTravelMotion({
          toFocus: travelFocusCurrent.clone(),
          toZoom: 0,
          toIntensity: 0,
          durationMs: Number.isFinite(payload.durationMs) ? payload.durationMs : 1400,
          hideFocusAtEnd: true,
        })
      }
    }
  }

  window.addEventListener('message', onPointerMessage)
  window.addEventListener('message', onTravelMessage)
  const detachPointerEvents = attachPointerEvents({ canvas, pointer, pointerTarget, pointerLockState, pointerRuntime })
  const detachResize = attachResizeHandler({
    camera,
    renderer,
    materials: [spaceMaterial, universeMaterial],
  })

  renderer.setAnimationLoop(() => {
    const nowMs = performance.now()
    introCameraProgressCurrent = updateIntroAnimation({
      introState,
      spaceMaterial,
      spacePoints,
      universePoints,
      nowMs,
    })

    const isHoverLocked = pointerLockState.active
    const targetTimeScale = isHoverLocked ? HOVER_TIME_SCALE : 1
    motionTimeScale += (targetTimeScale - motionTimeScale) * HOVER_TIME_SCALE_LERP

    const targetSpaceMouseRadius = SETTINGS.space.mouse.radius * (isHoverLocked ? HOVER_SPACE_MOUSE_RADIUS_MULT : 1)
    const targetSpaceMouseStrength = SETTINGS.space.mouse.strength * (isHoverLocked ? HOVER_SPACE_MOUSE_STRENGTH_MULT : 1)
    const targetUniverseMouseRadius = SETTINGS.universe.mouse.radius * (isHoverLocked ? HOVER_UNIVERSE_MOUSE_RADIUS_MULT : 1)
    const targetUniverseMouseStrength = SETTINGS.universe.mouse.strength * (isHoverLocked ? HOVER_UNIVERSE_MOUSE_STRENGTH_MULT : 1)

    spaceMouseRadiusCurrent += (targetSpaceMouseRadius - spaceMouseRadiusCurrent) * HOVER_MOUSE_UNIFORM_LERP
    spaceMouseStrengthCurrent += (targetSpaceMouseStrength - spaceMouseStrengthCurrent) * HOVER_MOUSE_UNIFORM_LERP
    universeMouseRadiusCurrent += (targetUniverseMouseRadius - universeMouseRadiusCurrent) * HOVER_MOUSE_UNIFORM_LERP
    universeMouseStrengthCurrent += (targetUniverseMouseStrength - universeMouseStrengthCurrent) * HOVER_MOUSE_UNIFORM_LERP

    spaceMaterial.uniforms.uMouseRadius.value = spaceMouseRadiusCurrent
    spaceMaterial.uniforms.uMouseStrength.value = spaceMouseStrengthCurrent
    universeMaterial.uniforms.uMouseRadius.value = universeMouseRadiusCurrent
    universeMaterial.uniforms.uMouseStrength.value = universeMouseStrengthCurrent

    if (pointerLockState.active) {
      pointerTarget.set(pointerLockState.x, pointerLockState.y)
    }
    pointer.lerp(pointerTarget, SETTINGS.animation.pointerLerp)
    const pointerDelta = pointer.distanceTo(pointerPrevious)
    pointerPrevious.copy(pointer)
    const targetMouseVelocity = pointerRuntime.hidden ? 0 : pointerDelta
    mouseVelocityCurrent += (targetMouseVelocity - mouseVelocityCurrent) * 0.2
    spaceMaterial.uniforms.uMouse.value.copy(pointer)
    universeMaterial.uniforms.uMouse.value.copy(pointer)
    spaceMaterial.uniforms.uMouseVelocity.value = mouseVelocityCurrent
    universeMaterial.uniforms.uMouseVelocity.value = mouseVelocityCurrent * 0.9

    if (travelMotion.active) {
      const progress = clamp((nowMs - travelMotion.startMs) / travelMotion.durationMs, 0, 1)
      travelFocusCurrent.set(
        lerp(travelMotion.fromFocus.x, travelMotion.toFocus.x, progress),
        lerp(travelMotion.fromFocus.y, travelMotion.toFocus.y, progress),
      )
      travelZoomCurrent = lerp(travelMotion.fromZoom, travelMotion.toZoom, progress)
      travelIntensityCurrent = lerp(travelMotion.fromIntensity, travelMotion.toIntensity, progress)

      if (progress >= 1) {
        travelMotion.active = false
        if (travelMotion.hideFocusAtEnd) {
          travelFocusCurrent.set(POINTER_OFFSCREEN, POINTER_OFFSCREEN)
        }
      }
    }

    spaceMaterial.uniforms.uTravelFocus.value.copy(travelFocusCurrent)
    spaceMaterial.uniforms.uTravelIntensity.value = travelIntensityCurrent
    universeMaterial.uniforms.uTravelFocus.value.copy(travelFocusCurrent)
    universeMaterial.uniforms.uTravelIntensity.value = travelIntensityCurrent

    applyTravelCamera()

    spaceMaterial.uniforms.uTime.value += (SETTINGS.animation.timeStep / 2) * motionTimeScale
    universeMaterial.uniforms.uTime.value += (SETTINGS.animation.timeStep / 3) * motionTimeScale

    renderer.render(scene, camera)

    motionFrame = (motionFrame + 1) % MOTION_POST_EVERY_N_FRAMES
    if (motionFrame === 0) {
      window.postMessage({
        type: MOTION_MESSAGE_TYPE,
        payload: createMotionPayload({ spaceMaterial, spacePoints, introState }),
      }, '*')
    }
  })

  return () => {
    renderer.setAnimationLoop(null)
    detachPointerEvents()
    detachResize()
    window.removeEventListener('message', onPointerMessage)
    window.removeEventListener('message', onTravelMessage)

    saveSceneStateSnapshot({
      uTime: Math.max(0, spaceMaterial.uniforms.uTime.value),
      rotationY: spacePoints.rotation.y,
      radius: clamp(spaceMaterial.uniforms.uRadius.value, 0, SETTINGS.intro.radius),
      introDone: introState.done,
    })

    spaceGeometry.dispose()
    universeGeometry.dispose()
    spaceMaterial.dispose()
    universeMaterial.dispose()
    alphaMap.dispose()
    renderer.dispose()
  }
}

