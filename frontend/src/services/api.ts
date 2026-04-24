/* ── Types ─────────────────────────────── */

import type { MediaMimeType } from "@/lib/media-types"

export interface ApiRequestOptions {
  method?: string
  body?: unknown
  token?: string
  headers?: Record<string, string>
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
  isFollowing?: boolean
  followersCount?: number
  followingCount?: number
  capsulesCount?: number
  createdAt?: string
  role?: string
  mustChangePassword?: boolean
  impersonating?: boolean
  actingAdminId?: string
  actingAdminEmail?: string
}

export interface UserPublic {
  id: string
  username: string
  displayName: string
  avatar?: string
  avatarUrl?: string
  bio?: string
  isFollowing?: boolean
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
  type?: 'text' | 'image' | 'video' | 'capsule_share'
  capsuleId?: string | null
  capsuleTitle?: string | null
  replyToMessageId?: string | null
  mediaUrl?: string | null
  mediaKind?: 'image' | 'video' | null
  mimeType?: MediaMimeType | null
}

export interface ChatAttachmentUploadResponse {
  url: string
  mediaKind: 'image' | 'video'
  mimeType: MediaMimeType
}

export interface MediaItem {
  id: string
  url: string
  type: 'image' | 'video'
  thumbnail?: string
  alt?: string
  meta?: unknown
}

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number] // [lon, lat]
}

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

export interface Capsule {
  id: string
  ownerId?: string | null
  title: string
  body?: string | null
  status: 'draft' | 'sealed' | 'opened'
  visibility: 'private' | 'public' | 'shared'
  isLocked: boolean
  unlockAt?: string | null
  openedAt?: string | null
  expiresAt?: string | null
  geoMarkerId?: string | null
  shareToken?: string | null
  allowComments?: boolean
  allowReactions?: boolean
  tags?: string[] | null
  coverImageUrl?: string | null
  media?: MediaItem[] | null
  location?: GeoPoint | null
}

export interface CreateCapsulePayload {
  title: string
  body?: string | null
  visibility: 'private' | 'public' | 'shared'
  status?: 'draft' | 'sealed' | 'opened'
  unlockAt?: string | null
  expiresAt?: string | null
  allowComments: boolean
  allowReactions: boolean
  tags?: string[] | null
  coverImageUrl?: string | null
  media?: MediaItem[] | null
  location?: GeoPoint | null
}

export interface UpdateCapsulePayload {
  title: string
  body?: string | null
  visibility: 'private' | 'public' | 'shared'
  status: 'draft' | 'sealed' | 'opened'
  unlockAt?: string | null
  expiresAt?: string | null
  allowComments: boolean
  allowReactions: boolean
  tags?: string[] | null
  coverImageUrl?: string | null
  media?: MediaItem[] | null
  location?: GeoPoint | null
}

export interface CapsuleMapMarker {
  id: string
  title: string
  ownerId: string
  ownerName: string
  ownerAvatarUrl?: string | null
  visibility: 'private' | 'public' | 'shared'
  status: 'draft' | 'sealed' | 'opened'
  isLocked: boolean
  isOwn: boolean
  coverImageUrl?: string | null
  unlockAt?: string | null
  openedAt?: string | null
  tags?: string[] | null
  coordinates: [number, number] // [lon, lat]
}

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/

function normalizeObjectId(id: string, label = 'id'): string {
  let normalized = String(id || '').trim()
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // keep original segment
  }
  if (!OBJECT_ID_RE.test(normalized)) {
    throw { status: 400, message: `Invalid ${label}` } as ApiError
  }
  return normalized
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

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = normalizeApiOrigin(window.location.origin)
    // Dev fallback: if running on Vite (5173) but backend on 8080
    if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
      return normalizeApiOrigin(origin.replace('5173', '8080'))
    }
    return origin
  }
  return ''
}

/* ── Core request ─────────────────────── */

//
export async function apiRequest(path: string, opts: ApiRequestOptions = {}): Promise<any> {
  const { method = 'POST', body, token } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: isFormData ? (opts as any).headers || {} : headers,
    credentials: 'include',
    cache: 'no-store',
    body: body ? (isFormData ? body as any : JSON.stringify(body)) : undefined,
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

export async function requestPasswordChangeCode(): Promise<void> {
  await apiRequest('/api/users/me/password/request-code', { method: 'POST' })
}

export async function confirmPasswordChangeByCode(payload: { code: string; newPassword: string }): Promise<void> {
  await apiRequest('/api/users/me/password/confirm', { method: 'POST', body: payload })
}

export async function changeMyPassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
  await apiRequest('/api/users/me/password/change', { method: 'POST', body: payload })
}

export async function searchUsers(query: string): Promise<UserPublic[]> {
  return apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`, { method: 'GET' })
}

export async function getSuggestedUsers(): Promise<UserPublic[]> {
  return apiRequest('/api/users/suggestions', { method: 'GET' })
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

export async function listPublicCapsules(): Promise<Capsule[]> {
  return apiRequest('/api/capsules/public', { method: 'GET' })
}

export async function listCapsuleMapMarkers(): Promise<CapsuleMapMarker[]> {
  return apiRequest('/api/capsules/map', { method: 'GET' })
}

// Повертає деталі капсули за її ID
export async function getCapsule(id: string): Promise<Capsule> {
  const normalizedId = normalizeObjectId(id, 'capsule id')
  return apiRequest(`/api/capsules/${normalizedId}`, { method: 'GET' })
}

export async function getEditableCapsule(id: string): Promise<Capsule> {
  const normalizedId = normalizeObjectId(id, 'capsule id')
  return apiRequest(`/api/capsules/${normalizedId}/edit`, { method: 'GET' })
}

export async function updateCapsule(id: string, capsuleData: UpdateCapsulePayload): Promise<Capsule> {
  const normalizedId = normalizeObjectId(id, 'capsule id')
  return apiRequest(`/api/capsules/${normalizedId}`, { method: 'PUT', body: capsuleData })
}

// Розблоковує капсулу, якщо настав час розблокування
export async function unlockCapsule(id: string): Promise<Capsule> {
  return apiRequest(`/api/capsules/${id}/unlock`, { method: 'POST' })
}

/* ── Media API ─────────────────────────── */

export async function uploadMedia(_capsuleId: string, file: File): Promise<MediaItem> {
  return uploadCapsuleAttachment(file)
}

/* ── Cover Image Upload ─────────────────── */

/**
 * Завантажує обкладинку капсули на сервер і повертає URL.
 * Використовується перед createCapsule щоб перетворити File → URL.
 */
export async function uploadCoverImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/media/cover`, {
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
  return typeof data === 'string' ? data : (data?.url ?? data?.imageUrl ?? '')
}

export async function uploadAvatarImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/media/avatar`, {
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
  return typeof data === 'string' ? data : (data?.url ?? data?.imageUrl ?? '')
}

export async function uploadChatAttachment(file: File): Promise<ChatAttachmentUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/media/chat-attachment`, {
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
  return data as ChatAttachmentUploadResponse
}

export async function uploadTagImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/media/tag-image`, {
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
  return typeof data === 'string' ? data : (data?.url ?? '')
}

export async function uploadCapsuleAttachment(file: File): Promise<MediaItem> {
  const formData = new FormData()
  formData.append('file', file)
  const base = getApiBase()
  const res = await fetch(`${base}/api/media/capsule-attachment`, {
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
  return data as MediaItem
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

export async function sendChatMessage(
  userId: string,
  payload: {
    text?: string
    replyToMessageId?: string | null
    mediaUrl?: string | null
    mediaKind?: 'image' | 'video' | null
    mimeType?: MediaMimeType | null
  }
): Promise<ChatMessage> {
  const replyToMessageId = payload.replyToMessageId && /^[a-fA-F0-9]{24}$/.test(payload.replyToMessageId)
    ? payload.replyToMessageId
    : null

  return apiRequest(`/api/chat/${userId}/messages`, {
    method: 'POST',
    body: {
      text: payload.text ?? '',
      replyToMessageId,
      mediaUrl: payload.mediaUrl || null,
      mediaKind: payload.mediaKind || null,
      mimeType: payload.mimeType || null,
    }
  })
}

/* ── Share API ─────────────────────────── */

export async function shareCapsule(capsuleId: string, userIds: string[]): Promise<void> {
  return apiRequest(`/api/capsules/${capsuleId}/share`, { method: 'POST', body: { userIds } })
}

export async function getComments(capsuleId: string): Promise<CommentData[]> {
  return apiRequest(`/api/capsules/${capsuleId}/comments`, { method: 'GET' })
}

export async function addComment(capsuleId: string, body: string, parentCommentId?: string | null): Promise<CommentData> {
  return apiRequest(`/api/capsules/${capsuleId}/comments`, {
    method: 'POST',
    body: { body, parentCommentId: parentCommentId || null }
  })
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

/* ── Tag Types ─────────────────────────── */

export interface Tag {
  id: string
  name: string
  imageUrl?: string | null
  isSystem: boolean
  createdBy?: string | null
  createdAt?: string
}

function normalizeTagPayload(payload: any): Tag {
  const rec = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {}
  const idRaw = rec.id ?? rec._id ?? ''
  return {
    id: typeof idRaw === 'string' ? idRaw : String(idRaw || ''),
    name: typeof rec.name === 'string' ? rec.name : '',
    imageUrl: typeof rec.imageUrl === 'string' ? rec.imageUrl : null,
    isSystem: Boolean(rec.isSystem ?? rec.system),
    createdBy: typeof rec.createdBy === 'string' ? rec.createdBy : null,
    createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : undefined,
  }
}

function normalizeTagListPayload(payload: any): Tag[] {
  if (!Array.isArray(payload)) return []
  return payload.map(normalizeTagPayload).filter((tag) => !!tag.name)
}

/* ── Tag API ───────────────────────────── */

export async function listTags(): Promise<Tag[]> {
  return normalizeTagListPayload(await apiRequest('/api/tags', { method: 'GET' }))
}

export async function searchTags(query: string): Promise<Tag[]> {
  return normalizeTagListPayload(await apiRequest(`/api/tags/search?q=${encodeURIComponent(query)}`, { method: 'GET' }))
}

export async function createTag(name: string, imageFile?: File | null): Promise<Tag> {
  const form = new FormData();
  form.append('name', name);
  if (imageFile) form.append('image', imageFile);
  return normalizeTagPayload(await apiRequest('/api/tags', { method: 'POST', body: form, headers: {} }));
}

/* ── Calendar API ──────────────────────── */

export async function listCapsulesByDateRange(from: string, to: string): Promise<Capsule[]> {
  return apiRequest(`/api/capsules/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'GET' })
}

/* ── Admin Types ───────────────────────── */

export interface AdminPagedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface AdminUser {
  id: string
  username: string
  email: string
  role: string
  enabled: boolean
  status?: 'active' | 'blocked' | 'disabled' | 'deleted'
  mustChangePassword?: boolean
  avatarUrl: string
  createdAt: string
  blockedUntil?: string
  deletedAt?: string
}

export interface AdminCapsule {
  id: string
  title: string
  body?: string
  status: string
  visibility: string
  ownerId: string
  unlockAt?: string | null
  expiresAt?: string
  createdAt: string
  updatedAt?: string
  allowComments?: boolean
  allowReactions?: boolean
  tags: string[]
  media?: Array<{ id?: string; url?: string; type?: string; meta?: unknown }>
  coverImageUrl: string
  deletedAt?: string
}

export interface AdminAuditLog {
  id: string
  actorId?: string
  actorEmail?: string
  actorRole?: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
  createdAt: string
}

export interface AdminCollectionDoc {
  _id: string | { $oid?: string }
  [key: string]: unknown
}

/* ── Admin API ─────────────────────────── */

export async function adminGetStats(): Promise<Record<string, number>> {
  return apiRequest('/api/admin/stats', { method: 'GET' })
}

export async function adminListUsers(
  q = '',
  page = 0,
  size = 20,
  role: 'all' | 'admin' | 'regular' = 'all',
  status: 'all' | 'active' | 'blocked' | 'pending' | 'disabled' | 'deleted' = 'all',
  includeDeleted = false,
  onlyBlocked = false
): Promise<AdminPagedResponse<AdminUser>> {
  return apiRequest(
    `/api/admin/users?q=${encodeURIComponent(q)}&page=${page}&size=${size}&role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}&includeDeleted=${includeDeleted}&onlyBlocked=${onlyBlocked}`,
    { method: 'GET' }
  )
}

export async function adminCreateUser(payload: {
  username: string
  email: string
  password: string
  role?: string
  enabled?: boolean
}): Promise<AdminUser> {
  return apiRequest('/api/admin/users', { method: 'POST', body: payload })
}

export async function adminUpdateUser(id: string, updates: Record<string, unknown>): Promise<AdminUser> {
  return apiRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: updates })
}

export async function adminDeleteUser(id: string): Promise<void> {
  return apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' })
}

export async function adminRestoreUser(id: string): Promise<AdminUser> {
  return apiRequest(`/api/admin/users/${id}/restore`, { method: 'POST' })
}

export async function adminSendTemporaryPassword(id: string): Promise<{ message: string }> {
  return apiRequest(`/api/admin/users/${id}/password/temporary`, { method: 'POST' })
}

export async function adminImpersonateUser(id: string): Promise<{ impersonating?: boolean; actingAdminId?: string; actingAdminEmail?: string }> {
  return apiRequest(`/api/admin/users/${id}/impersonate`, { method: 'POST' })
}

export async function adminBulkUsers(ids: string[], action: string, value?: string): Promise<{ modified: number }> {
  return apiRequest('/api/admin/users/bulk', { method: 'POST', body: { ids, action, value } })
}

export async function stopImpersonation(): Promise<void> {
  await apiRequest('/api/auth/impersonation/stop', { method: 'POST' })
}

export async function adminListCapsules(q = '', page = 0, size = 20, includeDeleted = false): Promise<AdminPagedResponse<AdminCapsule>> {
  return apiRequest(`/api/admin/capsules?q=${encodeURIComponent(q)}&page=${page}&size=${size}&includeDeleted=${includeDeleted}`, { method: 'GET' })
}

export async function adminDeleteCapsule(id: string): Promise<void> {
  return apiRequest(`/api/admin/capsules/${id}`, { method: 'DELETE' })
}

export async function adminRestoreCapsule(id: string): Promise<AdminCapsule> {
  return apiRequest(`/api/admin/capsules/${id}/restore`, { method: 'POST' })
}

export async function adminBulkCapsules(ids: string[], action: string, value?: string): Promise<{ modified: number }> {
  return apiRequest('/api/admin/capsules/bulk', { method: 'POST', body: { ids, action, value } })
}

export async function adminUpdateCapsule(id: string, updates: Record<string, unknown>): Promise<AdminCapsule> {
  return apiRequest(`/api/admin/capsules/${id}`, { method: 'PATCH', body: updates })
}

export async function adminListTags(): Promise<Tag[]> {
  return normalizeTagListPayload(await apiRequest('/api/admin/tags', { method: 'GET' }))
}

export async function adminDeleteTag(id: string): Promise<void> {
  return apiRequest(`/api/admin/tags/${id}`, { method: 'DELETE' })
}

export async function adminCreateTag(payload: { name: string; imageUrl?: string | null }): Promise<Tag> {
  return normalizeTagPayload(await apiRequest('/api/admin/tags', { method: 'POST', body: payload }))
}

export async function adminUpdateTag(id: string, updates: Record<string, unknown>): Promise<Tag> {
  return normalizeTagPayload(await apiRequest(`/api/admin/tags/${id}`, { method: 'PATCH', body: updates }))
}

export async function adminBulkTags(ids: string[], action: string): Promise<{ modified: number }> {
  return apiRequest('/api/admin/tags/bulk', { method: 'POST', body: { ids, action } })
}

export async function adminListAuditLogs(q = '', page = 0, size = 20): Promise<AdminPagedResponse<AdminAuditLog>> {
  return apiRequest(`/api/admin/audit-logs?q=${encodeURIComponent(q)}&page=${page}&size=${size}`, { method: 'GET' })
}

export async function adminListCollections(): Promise<string[]> {
  return apiRequest('/api/admin/collections', { method: 'GET' })
}

export async function adminListCollectionDocs(name: string, q = '', page = 0, size = 20): Promise<AdminPagedResponse<AdminCollectionDoc>> {
  return apiRequest(`/api/admin/collections/${encodeURIComponent(name)}?q=${encodeURIComponent(q)}&page=${page}&size=${size}`, { method: 'GET' })
}

export async function adminUpdateCollectionDoc(name: string, id: string, updates: Record<string, unknown>): Promise<AdminCollectionDoc> {
  return apiRequest(`/api/admin/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates })
}

export async function adminDeleteCollectionDoc(name: string, id: string): Promise<void> {
  return apiRequest(`/api/admin/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

