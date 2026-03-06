/* ── Types ─────────────────────────────── */

export interface ApiRequestOptions {
  method?: string
  body?: unknown
  token?: string
}

export interface ApiError {
  status: number
  message: string
  details?: unknown
}

export interface OAuthLink {
  provider: string
  href: string
}

export interface UserProfile {
  id: string
  email: string
  username?: string
  avatarUrl?: string
}

export interface Capsule {
  id: string
  title: string
  body?: string | null
  status: 'draft' | 'sealed' | 'opened'
  visibility: 'private' | 'public' | 'shared'
  isLocked: boolean
  unlockAt: string
  openedAt?: string | null
  expiresAt?: string | null
  shareToken?: string | null
  allowComments?: boolean
  allowReactions?: boolean
  tags?: string[] | null
  media?: unknown
  location?: unknown
}

export interface CreateCapsulePayload {
  title: string
  body?: string | null
  visibility: string
  status: string
  unlockAt: string
  expiresAt?: string | null
  allowComments: boolean
  allowReactions: boolean
  tags?: string[] | null
  media?: unknown
  location?: unknown
}

/* ── Helpers ───────────────────────────── */

// Очищає URL API від зайвих слешів та суфіксів
function normalizeApiOrigin(value: string): string {
  if (!value) return ''
  return value.replace(/\/+$/, '').replace(/\/api$/, '')
}

// Визначає базовий URL для API з оточення або поточного розташування
function getApiBase(): string {
  const fromEnv =
    import.meta.env.VITE_API_ORIGIN ||
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_URL

  if (fromEnv) return normalizeApiOrigin(fromEnv)
  if (typeof window !== 'undefined' && window.location?.origin) return normalizeApiOrigin(window.location.origin)
  return ''
}

/* ── Core request ─────────────────────── */

//
export async function apiRequest(path: string, opts: ApiRequestOptions = {}): Promise<any> {
  const { method = 'POST', body, token } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const message = data?.message || data?.error || text || `HTTP ${res.status}`
    const details = data?.errors || data?.trace
    throw { status: res.status, message, details } as ApiError
  }
  return data
}

/* ── OAuth ─────────────────────────────── */

// Повертає список посилань для OAuth авторизації
export function oauthLinks(): OAuthLink[] {
  const base = getApiBase()
  return [
    { provider: 'Google', href: `${base}/oauth2/authorization/google` },
    { provider: 'GitHub', href: `${base}/oauth2/authorization/github` },
  ]
}

/* ── User API ──────────────────────────── */

// Отримує профіль поточного користувача
export async function getCurrentUser(): Promise<UserProfile> {
  return apiRequest('/api/users/me', { method: 'GET' })
}

// Оновлює профіль поточного користувача
export async function updateCurrentUser(payload: Partial<UserProfile>): Promise<UserProfile> {
  return apiRequest('/api/users/me', { method: 'PATCH', body: payload })
}

/* ── Capsule API ───────────────────────── */

// Створює нову капсулу з вказаними даними
export async function createCapsule(capsuleData: CreateCapsulePayload): Promise<Capsule> {
  return apiRequest('/api/capsules', { method: 'POST', body: capsuleData })
}

// Повертає список капсул поточного користувача
export async function listMyCapsules(): Promise<Capsule[]> {
  return apiRequest('/api/capsules', { method: 'GET' })
}

// Повертає деталі капсули за її ID
export async function getCapsule(id: string): Promise<Capsule> {
  return apiRequest(`/api/capsules/${id}`, { method: 'GET' })
}

// Розблоковує капсулу, якщо настав час розблокування
export async function unlockCapsule(id: string): Promise<Capsule> {
  return apiRequest(`/api/capsules/${id}/unlock`, { method: 'POST' })
}

