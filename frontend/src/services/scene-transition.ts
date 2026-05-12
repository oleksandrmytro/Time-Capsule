const SCENE_RETURN_STORAGE_KEY = 'timecapsule.scene.return'
const SCENE_RETURN_MAX_AGE_MS = 60_000
const SCENE_STATE_STORAGE_KEY = 'timecapsule.scene.state'
const SCENE_STATE_MAX_AGE_MS = 90_000

export type SceneReturnSnapshot = {
  nodeId: string
  xRatio: number
  yRatio: number
  createdAt: number
}

export type SceneStateSnapshot = {
  uTime: number
  rotationY: number
  radius: number
  introDone: boolean
  createdAt: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function saveSceneReturnSnapshot(snapshot: Omit<SceneReturnSnapshot, 'createdAt'>): void {
  if (typeof window === 'undefined') return
  const payload: SceneReturnSnapshot = {
    ...snapshot,
    createdAt: Date.now(),
  }
  window.sessionStorage.setItem(SCENE_RETURN_STORAGE_KEY, JSON.stringify(payload))
}

export function consumeSceneReturnSnapshot(): SceneReturnSnapshot | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(SCENE_RETURN_STORAGE_KEY)
  if (!raw) return null

  window.sessionStorage.removeItem(SCENE_RETURN_STORAGE_KEY)

  try {
    const parsed = JSON.parse(raw) as Partial<SceneReturnSnapshot> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.nodeId !== 'string' || parsed.nodeId.length === 0) return null
    if (!isFiniteNumber(parsed.xRatio) || !isFiniteNumber(parsed.yRatio)) return null
    if (!isFiniteNumber(parsed.createdAt)) return null
    if (Date.now() - parsed.createdAt > SCENE_RETURN_MAX_AGE_MS) return null
    return {
      nodeId: parsed.nodeId,
      xRatio: parsed.xRatio,
      yRatio: parsed.yRatio,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

export function saveSceneStateSnapshot(snapshot: Omit<SceneStateSnapshot, 'createdAt'>): void {
  if (typeof window === 'undefined') return
  const payload: SceneStateSnapshot = {
    ...snapshot,
    createdAt: Date.now(),
  }
  window.sessionStorage.setItem(SCENE_STATE_STORAGE_KEY, JSON.stringify(payload))
}

export function consumeSceneStateSnapshot(): SceneStateSnapshot | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(SCENE_STATE_STORAGE_KEY)
  if (!raw) return null

  window.sessionStorage.removeItem(SCENE_STATE_STORAGE_KEY)

  try {
    const parsed = JSON.parse(raw) as Partial<SceneStateSnapshot> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (!isFiniteNumber(parsed.uTime) || !isFiniteNumber(parsed.rotationY) || !isFiniteNumber(parsed.radius)) return null
    if (typeof parsed.introDone !== 'boolean') return null
    if (!isFiniteNumber(parsed.createdAt)) return null
    if (Date.now() - parsed.createdAt > SCENE_STATE_MAX_AGE_MS) return null
    return {
      uTime: parsed.uTime,
      rotationY: parsed.rotationY,
      radius: parsed.radius,
      introDone: parsed.introDone,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}
