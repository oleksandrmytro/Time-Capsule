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
  displayName?: string
  avatarUrl?: string
  bio?: string
  location?: string
  website?: string
  isOnline?: boolean
  isFollowing?: boolean
  followersCount?: number
  followingCount?: number
  capsulesCount?: number
  createdAt?: string
}

export interface UserPublic {
  id: string
  username: string
  displayName: string
  avatar?: string
  avatarUrl?: string
  bio?: string
  isFollowing?: boolean
  isOnline?: boolean
  followersCount?: number
  followingCount?: number
  capsulesCount?: number
}

export interface ChatConversation {
  id: string
  user: {
    id: string
    username: string
    displayName: string
    avatar?: string
    isOnline: boolean
  }
  lastMessage: {
    text: string
    timestamp: string
    isRead: boolean
    fromMe: boolean
  }
}

export interface ChatMessage {
  id: string
  text: string
  timestamp: string
  fromMe: boolean
  status?: 'sending' | 'sent' | 'delivered' | 'read'
  type?: 'text' | 'capsule_share'
  capsuleId?: string | null
  capsuleTitle?: string | null
  replyToMessageId?: string | null
}

export interface MediaItem {
  id: string
  url: string
  type: 'image' | 'video'
  thumbnail?: string
  alt?: string
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
  media?: MediaItem[] | null
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

/* ── Media API ─────────────────────────── */

export async function uploadMedia(capsuleId: string, file: File): Promise<MediaItem> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/capsules/${capsuleId}/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const text = await res.text()
  let data: any
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const message = data?.message || data?.error || text || `HTTP ${res.status}`
    throw { status: res.status, message } as ApiError
  }
  return data
}

/* ── User Search & Profiles API ────────── */

export async function searchUsers(query: string): Promise<UserPublic[]> {
  return apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`, { method: 'GET' })
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return apiRequest(`/api/users/${encodeURIComponent(username)}`, { method: 'GET' })
}

/* ── Follow API ────────────────────────── */

export async function followUser(userId: string): Promise<void> {
  return apiRequest(`/api/users/${userId}/follow`, { method: 'POST' })
}

export async function unfollowUser(userId: string): Promise<void> {
  return apiRequest(`/api/users/${userId}/unfollow`, { method: 'POST' })
}

export async function getFollowers(userId: string, page = 0): Promise<UserPublic[]> {
  return apiRequest(`/api/users/${userId}/followers?page=${page}`, { method: 'GET' })
}

export async function getFollowing(userId: string, page = 0): Promise<UserPublic[]> {
  return apiRequest(`/api/users/${userId}/following?page=${page}`, { method: 'GET' })
}

export async function getUserCapsules(userId: string): Promise<Capsule[]> {
  return apiRequest(`/api/users/${encodeURIComponent(userId)}/capsules`, { method: 'GET' })
}

/* ── Chat API ──────────────────────────── */

export async function getConversations(): Promise<ChatConversation[]> {
  return apiRequest('/api/chat/conversations', { method: 'GET' })
}

export async function getChatMessages(userId: string): Promise<ChatMessage[]> {
  return apiRequest(`/api/chat/${userId}/messages`, { method: 'GET' })
}

export async function sendChatMessage(userId: string, text: string, replyToMessageId?: string | null): Promise<ChatMessage> {
  return apiRequest(`/api/chat/${userId}/messages`, { method: 'POST', body: { text, replyToMessageId: replyToMessageId || null } })
}

/* ── Share API ─────────────────────────── */

export async function shareCapsule(capsuleId: string, userIds: string[]): Promise<void> {
  return apiRequest(`/api/capsules/${capsuleId}/share`, { method: 'POST', body: { userIds } })
}

/* ── Comment & Reaction Types ──────────── */

export interface CommentData {
  id: string
  capsuleId: string
  userId: string
  username: string
  avatarUrl?: string
  body: string
  parentCommentId?: string | null
  replies?: CommentData[]
  createdAt: string
}

export interface ReactionSummary {
  counts: Record<string, number>
  userReactions: string[]
}

/* ── Comment API ───────────────────────── */

// Повертає коментарі для капсули
export async function getComments(capsuleId: string): Promise<CommentData[]> {
  return apiRequest(`/api/capsules/${capsuleId}/comments`, { method: 'GET' })
}

// Додає коментар до капсули (parentCommentId для відповідей)
export async function addComment(capsuleId: string, body: string, parentCommentId?: string | null): Promise<CommentData> {
  return apiRequest(`/api/capsules/${capsuleId}/comments`, { method: 'POST', body: { body, parentCommentId: parentCommentId || null } })
}

// Видаляє коментар (soft delete)
export async function deleteComment(capsuleId: string, commentId: string): Promise<void> {
  return apiRequest(`/api/capsules/${capsuleId}/comments/${commentId}`, { method: 'DELETE' })
}

// Оновлює текст коментаря
export async function updateComment(capsuleId: string, commentId: string, body: string): Promise<CommentData> {
  return apiRequest(`/api/capsules/${capsuleId}/comments/${commentId}`, { method: 'PATCH', body: { body } })
}

/* ── Reaction API ──────────────────────── */

// Повертає підсумок реакцій для капсули
export async function getReactionSummary(capsuleId: string): Promise<ReactionSummary> {
  return apiRequest(`/api/capsules/${capsuleId}/reactions`, { method: 'GET' })
}

// Перемикає реакцію (додає або знімає)
export async function toggleReaction(capsuleId: string, type: string): Promise<ReactionSummary> {
  return apiRequest(`/api/capsules/${capsuleId}/reactions`, { method: 'POST', body: { type } })
}

export { getApiBase }
