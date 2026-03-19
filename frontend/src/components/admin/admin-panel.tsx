import { useState, useEffect, useCallback } from "react"
import { useNavigate, Routes, Route, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CoverUploader } from "@/components/capsules/cover-uploader"
import { MediaUploader, type MediaFile } from "@/components/media/media-uploader"
import {
  Users, Archive, Tag, ArrowLeft,
  Search, ChevronLeft, ChevronRight, Trash2, Edit, Shield,
  X, Loader2, Database, History, RotateCcw
} from "lucide-react"
import {
  adminListUsers, adminUpdateUser, adminDeleteUser,
  adminListCapsules, adminDeleteCapsule, adminListTags, adminDeleteTag,
  adminUpdateCapsule, adminUpdateTag, adminListCollections, adminListCollectionDocs,
  adminUpdateCollectionDoc, adminDeleteCollectionDoc, adminRestoreUser, adminBulkUsers,
  adminRestoreCapsule, adminBulkCapsules, adminCreateTag, adminBulkTags, adminListAuditLogs,
  uploadTagImage, uploadCoverImage, uploadCapsuleAttachment,
  type AdminUser, type AdminCapsule, type Tag as TagType, type AdminCollectionDoc, type AdminAuditLog, type MediaItem
} from "@/services/api"

/* ── Admin Layout ──────────────────────── */

export function AdminPanel() {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { path: "/admin/users", label: "Users", icon: Users, desc: "Accounts and access" },
    { path: "/admin/capsules", label: "Capsules", icon: Archive, desc: "User content and media" },
    { path: "/admin/tags", label: "Tags", icon: Tag, desc: "Taxonomy and labels" },
    { path: "/admin/audit", label: "Audit", icon: History, desc: "Activity log" },
    { path: "/admin/data", label: "Data", icon: Database, desc: "Raw collections" },
  ]
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))

  useEffect(() => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/users", { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-5 -ml-3 gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Button>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight text-foreground">
          <Shield className="h-7 w-7" /> Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Centralized management for users, capsules, tags, audit trail and raw database documents.
        </p>
      </div>

      <div className="mb-7 rounded-2xl border border-border bg-card p-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {tabs.map((tab) => {
            const isActive = !!activeTab && activeTab.path === tab.path
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-background hover:border-primary/20 hover:bg-muted/40"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{tab.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{tab.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <Routes>
          <Route index element={<AdminUsersTable />} />
          <Route path="users" element={<AdminUsersTable />} />
          <Route path="capsules" element={<AdminCapsulesTable />} />
          <Route path="tags" element={<AdminTagsTable />} />
          <Route path="audit" element={<AdminAuditTable />} />
          <Route path="data" element={<AdminDataTable />} />
        </Routes>
      </div>
    </div>
  )
}

/* ── Dashboard ─────────────────────────── */

/* ── Users Table ───────────────────────── */

function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingEditor, setSavingEditor] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editDisplayName, setEditDisplayName] = useState("")
  const [editRole, setEditRole] = useState("regular")
  const [editEnabled, setEditEnabled] = useState(true)
  const [editBlockedUntil, setEditBlockedUntil] = useState("")
  const [editAvatarUrl, setEditAvatarUrl] = useState("")
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)
  const [editPassword, setEditPassword] = useState("")
  const [editorError, setEditorError] = useState<string | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [onlyBlocked, setOnlyBlocked] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("disable")
  const [bulkValue, setBulkValue] = useState("")
  const SIZE = 15

  const toLocalInputValue = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListUsers(search, page, SIZE, includeDeleted, onlyBlocked)
      setUsers(res.items || [])
      setTotal(res.total || 0)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [search, page, includeDeleted, onlyBlocked])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Soft delete this user?")) return
    try {
      await adminDeleteUser(id)
      load()
    } catch {}
  }

  const handleRestore = async (id: string) => {
    try {
      await adminRestoreUser(id)
      load()
    } catch {}
  }

  const openEditor = (user: AdminUser) => {
    setEditingUser(user)
    setEditUsername(user.username || "")
    setEditEmail(user.email || "")
    setEditDisplayName((user as any).displayName || "")
    setEditRole(user.role || "regular")
    setEditEnabled(!!user.enabled)
    setEditBlockedUntil(toLocalInputValue(user.blockedUntil))
    setEditAvatarUrl(user.avatarUrl || "")
    setEditAvatarFile(null)
    setEditPassword("")
    setEditorError(null)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingUser(null)
    setEditAvatarFile(null)
    setEditPassword("")
    setEditorError(null)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSavingEditor(true)
    setEditorError(null)
    try {
      let avatarUrl = editAvatarUrl || null
      if (editAvatarFile) {
        avatarUrl = await uploadCoverImage(editAvatarFile)
      }

      const updates: Record<string, unknown> = {
        username: editUsername.trim(),
        email: editEmail.trim(),
        displayName: editDisplayName.trim() || null,
        avatarUrl,
        role: editRole,
        enabled: editEnabled,
        blockedUntil: editBlockedUntil ? new Date(editBlockedUntil).toISOString() : null,
      }
      if (editPassword.trim()) {
        updates.password = editPassword
      }

      await adminUpdateUser(editingUser.id, {
        ...updates,
      })
      closeEditor()
      load()
    } catch (error: any) {
      setEditorError(error?.message || "Failed to update user")
    } finally {
      setSavingEditor(false)
    }
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(v => v !== id))
  }

  const applyBulk = async () => {
    if (selectedIds.length === 0) return
    try {
      await adminBulkUsers(selectedIds, bulkAction, bulkValue || undefined)
      setSelectedIds([])
      load()
    } catch {}
  }

  const totalPages = Math.ceil(total / SIZE)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{total} users</p>
        <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(0) }} /> include deleted
        </label>
        <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <input type="checkbox" checked={onlyBlocked} onChange={(e) => { setOnlyBlocked(e.target.checked); setPage(0) }} /> only blocked
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="h-9 rounded border border-border bg-background px-2 text-xs">
          <option value="disable">Disable</option>
          <option value="enable">Enable</option>
          <option value="delete">Soft delete</option>
          <option value="restore">Restore</option>
          <option value="role">Set role</option>
          <option value="block">Block until date</option>
          <option value="unblock">Unblock</option>
        </select>
        {(bulkAction === "role" || bulkAction === "block") && (
          <Input
            className="h-9 w-[220px]"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={bulkAction === "role" ? "admin or regular" : "2026-03-20T12:00:00"}
          />
        )}
        <Button size="sm" disabled={selectedIds.length === 0} onClick={applyBulk}>Apply bulk ({selectedIds.length})</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.length === users.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? users.map((u) => u.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={(e) => toggleSelect(user.id, e.target.checked)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                            {(user.username || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{user.username || "—"}</p>
                          <div className="flex items-center gap-1">
                            {user.isOnline && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            <span className="text-xs text-muted-foreground">{user.isOnline ? "Online" : "Offline"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {user.role === "admin" ? <Shield className="mr-1 h-3 w-3" /> : null}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.enabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {user.status || (user.enabled ? "active" : "disabled")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditor(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.deletedAt ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRestore(user.id)}>
                            <RotateCcw className="h-4 w-4 text-emerald-500" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open) closeEditor(); else setEditorOpen(true) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              {editingUser ? `Update access settings for @${editingUser.username || editingUser.email}.` : "Update user settings."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Login (username)</Label>
            <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Leave empty to keep current password"
            />
          </div>

          <div className="space-y-2">
            <Label>Avatar</Label>
            {editAvatarUrl && !editAvatarFile ? (
              <img src={editAvatarUrl} alt="user avatar" className="h-16 w-16 rounded-full object-cover" />
            ) : null}
            {editAvatarFile ? <p className="text-xs text-muted-foreground">Selected: {editAvatarFile.name}</p> : null}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setEditAvatarFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="regular">regular</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={editEnabled ? "enabled" : "disabled"}
              onChange={(e) => setEditEnabled(e.target.value === "enabled")}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Blocked Until (optional)</Label>
            <Input
              type="datetime-local"
              value={editBlockedUntil}
              onChange={(e) => setEditBlockedUntil(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave empty to remove block.</p>
          </div>

          {editorError && <p className="text-sm text-destructive">{editorError}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={savingEditor || !editingUser || !editUsername.trim() || !editEmail.trim()}>
              {savingEditor ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : "Save user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

/* ── Capsules Table ────────────────────── */

function AdminCapsulesTable() {
  const [capsules, setCapsules] = useState<AdminCapsule[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("delete")
  const [bulkValue, setBulkValue] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingEditor, setSavingEditor] = useState(false)
  const [editCapsuleId, setEditCapsuleId] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editVisibility, setEditVisibility] = useState("private")
  const [editStatus, setEditStatus] = useState("draft")
  const [editAllowComments, setEditAllowComments] = useState(false)
  const [editAllowReactions, setEditAllowReactions] = useState(false)
  const [editUnlockAt, setEditUnlockAt] = useState("")
  const [editExpiresAt, setEditExpiresAt] = useState("")
  const [editOwnerId, setEditOwnerId] = useState("")
  const [editTagsRaw, setEditTagsRaw] = useState("")
  const [editCoverValue, setEditCoverValue] = useState<File | string | null>(null)
  const [editMediaExisting, setEditMediaExisting] = useState<MediaItem[]>([])
  const [editMediaFiles, setEditMediaFiles] = useState<MediaFile[]>([])
  const [editMediaReplacementFiles, setEditMediaReplacementFiles] = useState<Record<string, File>>({})
  const SIZE = 15

  const toLocalInputValue = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListCapsules(search, page, SIZE, includeDeleted)
      setCapsules(res.items || [])
      setTotal(res.total || 0)
    } catch {
      setCapsules([])
    } finally {
      setLoading(false)
    }
  }, [search, page, includeDeleted])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Soft delete this capsule?")) return
    try {
      await adminDeleteCapsule(id)
      load()
    } catch {}
  }

  const handleRestore = async (id: string) => {
    try {
      await adminRestoreCapsule(id)
      load()
    } catch {}
  }

  const applyBulk = async () => {
    if (selectedIds.length === 0) return
    try {
      await adminBulkCapsules(selectedIds, bulkAction, bulkValue || undefined)
      setSelectedIds([])
      load()
    } catch {}
  }

  const startEdit = (capsule: AdminCapsule) => {
    setEditCapsuleId(capsule.id)
    setEditTitle(capsule.title || "")
    setEditBody(capsule.body || "")
    setEditVisibility(capsule.visibility || "private")
    setEditStatus(capsule.status || "draft")
    setEditAllowComments(!!capsule.allowComments)
    setEditAllowReactions(!!capsule.allowReactions)
    setEditUnlockAt(toLocalInputValue(capsule.unlockAt))
    setEditExpiresAt(toLocalInputValue(capsule.expiresAt))
    setEditOwnerId(capsule.ownerId || "")
    setEditTagsRaw((capsule.tags || []).join(", "))
    setEditCoverValue(capsule.coverImageUrl || null)
    setEditMediaExisting((capsule.media || []).map((m) => ({
      id: String(m.id || crypto.randomUUID()),
      url: String(m.url || ""),
      type: m.type === "video" ? "video" : "image",
      meta: m.meta,
    })))
    setEditMediaFiles([])
    setEditMediaReplacementFiles({})
    setEditorOpen(true)
  }

  const removeExistingMedia = (id: string) => {
    setEditMediaExisting((prev) => prev.filter((m) => m.id !== id))
    setEditMediaReplacementFiles((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const setReplacementMediaFile = (id: string, file: File | null) => {
    setEditMediaReplacementFiles((prev) => {
      const next = { ...prev }
      if (file) next[id] = file
      else delete next[id]
      return next
    })
  }

  const saveEdit = async () => {
    if (!editCapsuleId) return
    try {
      setSavingEditor(true)
      let resolvedCover: string | null = null
      if (editCoverValue instanceof File) {
        resolvedCover = await uploadCoverImage(editCoverValue)
      } else {
        resolvedCover = typeof editCoverValue === "string" ? editCoverValue : null
      }

      const replacedExisting: MediaItem[] = []
      for (const existing of editMediaExisting) {
        const replacementFile = editMediaReplacementFiles[existing.id]
        if (replacementFile) {
          const uploadedReplacement = await uploadCapsuleAttachment(replacementFile)
          replacedExisting.push(uploadedReplacement)
        } else {
          replacedExisting.push(existing)
        }
      }

      const uploaded: MediaItem[] = []
      for (const f of editMediaFiles) {
        const media = await uploadCapsuleAttachment(f.file)
        uploaded.push(media)
      }

      await adminUpdateCapsule(editCapsuleId, {
        title: editTitle,
        body: editBody,
        visibility: editVisibility,
        status: editStatus,
        allowComments: editAllowComments,
        allowReactions: editAllowReactions,
        unlockAt: editUnlockAt ? new Date(editUnlockAt).toISOString() : null,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        ownerId: editOwnerId || null,
        tags: editTagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        coverImageUrl: resolvedCover,
        media: [...replacedExisting, ...uploaded],
      })
      setEditorOpen(false)
      setEditMediaReplacementFiles({})
      load()
    } catch {
    } finally {
      setSavingEditor(false)
    }
  }

  const totalPages = Math.ceil(total / SIZE)

  const statusColor = (status: string) => {
    switch (status) {
      case "sealed": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      case "opened": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      case "draft": return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
      default: return "bg-secondary text-secondary-foreground"
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search capsules..."
            className="pl-10"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{total} capsules</p>
        <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(0) }} /> include deleted
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="h-9 rounded border border-border bg-background px-2 text-xs">
          <option value="delete">Soft delete</option>
          <option value="restore">Restore</option>
          <option value="status">Set status</option>
          <option value="visibility">Set visibility</option>
        </select>
        {(bulkAction === "status" || bulkAction === "visibility") && (
          <Input
            className="h-9 w-[180px]"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={bulkAction === "status" ? "draft/sealed/opened" : "private/public/shared"}
          />
        )}
        <Button size="sm" disabled={selectedIds.length === 0} onClick={applyBulk}>Apply bulk ({selectedIds.length})</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={capsules.length > 0 && selectedIds.length === capsules.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? capsules.map((c) => c.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Capsule</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Visibility</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unlock At</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : capsules.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No capsules found</td></tr>
              ) : (
                capsules.map(capsule => (
                  <tr key={capsule.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(capsule.id)} onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, capsule.id] : prev.filter(v => v !== capsule.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {capsule.coverImageUrl ? (
                          <img src={capsule.coverImageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <p className="font-medium text-foreground truncate max-w-[200px]">{capsule.title}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(capsule.status)}`}>
                        {capsule.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {capsule.visibility}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {capsule.unlockAt ? new Date(capsule.unlockAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {capsule.tags?.slice(0, 3).map(t => (
                          <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(capsule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {capsule.deletedAt ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRestore(capsule.id)}>
                            <RotateCcw className="h-4 w-4 text-emerald-500" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(capsule.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditMediaReplacementFiles({})
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Capsule</DialogTitle>
            <DialogDescription>Update unlock date, cover image, attachments and metadata in one place.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Message</Label>
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[110px]" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="draft">draft</option>
                <option value="sealed">sealed</option>
                <option value="opened">opened</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="private">private</option>
                <option value="public">public</option>
                <option value="shared">shared</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Unlock At</Label>
              <Input type="datetime-local" value={editUnlockAt} onChange={(e) => setEditUnlockAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expires At</Label>
              <Input type="datetime-local" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner ID</Label>
              <Input value={editOwnerId} onChange={(e) => setEditOwnerId(e.target.value)} placeholder="Mongo user id" />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input value={editTagsRaw} onChange={(e) => setEditTagsRaw(e.target.value)} placeholder="travel, memory" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <input type="checkbox" checked={editAllowComments} onChange={(e) => setEditAllowComments(e.target.checked)} /> allow comments
            </label>
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <input type="checkbox" checked={editAllowReactions} onChange={(e) => setEditAllowReactions(e.target.checked)} /> allow reactions
            </label>
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>
            <CoverUploader coverValue={editCoverValue} onCoverChange={setEditCoverValue} />
          </div>

          <div className="space-y-2">
            <Label>Current Attachments</Label>
            {editMediaExisting.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attachments</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {editMediaExisting.map((m) => (
                  <div key={m.id} className="relative rounded-md border border-border bg-muted/40 p-2">
                    {m.type === "image" ? (
                      <img src={m.url} alt="" className="mb-2 h-24 w-full rounded object-cover" />
                    ) : (
                      <video src={m.url} controls className="mb-2 h-24 w-full rounded object-cover" />
                    )}
                    <p className="truncate text-xs">{m.type}: {m.url}</p>
                    <Input
                      type="file"
                      accept="image/*,video/*"
                      className="mt-2 h-8 text-xs"
                      onChange={(e) => setReplacementMediaFile(m.id, e.target.files?.[0] || null)}
                    />
                    {editMediaReplacementFiles[m.id] ? (
                      <p className="mt-1 text-[11px] text-primary">Will replace with: {editMediaReplacementFiles[m.id].name}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">Keep current file</p>
                    )}
                    <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-6 w-6" onClick={() => removeExistingMedia(m.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Add New Attachments</Label>
            <MediaUploader files={editMediaFiles} onFilesChange={setEditMediaFiles} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEditor}>
              {savingEditor ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : "Save capsule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Tags Table ────────────────────────── */

function AdminTagsTable() {
  const [tags, setTags] = useState<TagType[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editImageUrl, setEditImageUrl] = useState("")
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [newName, setNewName] = useState("")
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminListTags()
      setTags(Array.isArray(data) ? data : [])
    } catch {
      setTags([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tag?")) return
    try {
      await adminDeleteTag(id)
      load()
    } catch {}
  }

  const startEdit = (tag: TagType) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditImageUrl(tag.imageUrl || "")
    setEditImageFile(null)
    setEditorOpen(true)
  }

  const saveEdit = async (id: string) => {
    try {
      let imageUrl = editImageUrl || null
      if (editImageFile) {
        imageUrl = await uploadTagImage(editImageFile)
      }
      await adminUpdateTag(id, { name: editName, imageUrl })
      setEditingId(null)
      setEditorOpen(false)
      load()
    } catch {}
  }

  const createNewTag = async () => {
    if (!newName.trim()) return
    try {
      let imageUrl: string | null = null
      if (newImageFile) {
        imageUrl = await uploadTagImage(newImageFile)
      }
      await adminCreateTag({ name: newName.trim(), imageUrl })
      setNewName("")
      setNewImageFile(null)
      load()
    } catch {}
  }

  const applyBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} tags?`)) return
    try {
      await adminBulkTags(selectedIds, "delete")
      setSelectedIds([])
      load()
    } catch {}
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tags.length} tags</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 w-[200px]" placeholder="New tag name" />
        <Input type="file" accept="image/*" className="h-9 w-[260px]" onChange={(e) => setNewImageFile(e.target.files?.[0] || null)} />
        <Button size="sm" onClick={createNewTag}>Add tag</Button>
        <Button size="sm" variant="destructive" disabled={selectedIds.length === 0} onClick={applyBulkDelete}>Delete selected ({selectedIds.length})</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={tags.length > 0 && selectedIds.length === tags.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? tags.map((t) => t.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tag</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : tags.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No tags found</td></tr>
              ) : (
                tags.map(tag => (
                  <tr key={tag.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(tag.id)} onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, tag.id] : prev.filter(v => v !== tag.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {tag.imageUrl ? (
                          <img src={tag.imageUrl} alt={tag.name} className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <p className="font-medium text-foreground">{tag.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        tag.isSystem
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {tag.isSystem ? "System" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {tag.createdAt ? new Date(tag.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(tag)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(tag.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Use image upload instead of manual URL editing.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Current Image</Label>
            {editImageUrl ? <img src={editImageUrl} alt="tag" className="h-20 w-20 rounded-lg object-cover" /> : <p className="text-xs text-muted-foreground">No image</p>}
          </div>
          <div className="space-y-2">
            <Label>New Image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setEditImageFile(e.target.files?.[0] || null)} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => editingId && saveEdit(editingId)}>Save tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Audit Table ───────────────────────── */

function AdminAuditTable() {
  const [rows, setRows] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListAuditLogs(search, page, SIZE)
      setRows(res.items || [])
      setTotal(res.total || 0)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / SIZE)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search action/entity/email..."
            className="pl-10"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{total} events</p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit events found</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-xs">{row.actorEmail || row.actorId || "—"}</td>
                  <td className="px-4 py-3"><span className="rounded bg-secondary px-2 py-0.5 text-xs">{row.action}</span></td>
                  <td className="px-4 py-3 text-xs">{row.entityType}:{row.entityId || "—"}</td>
                  <td className="px-4 py-3"><pre className="max-h-[140px] overflow-auto rounded-md bg-muted/40 p-2 text-xs">{JSON.stringify(row.details || {}, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ── Universal Data Table ───────────────── */

function AdminDataTable() {
  const [collections, setCollections] = useState<string[]>([])
  const [collection, setCollection] = useState<string>("")
  const [rows, setRows] = useState<AdminCollectionDoc[]>([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingEditor, setSavingEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editJson, setEditJson] = useState("")
  const [editorError, setEditorError] = useState<string | null>(null)
  const SIZE = 20

  const loadCollections = useCallback(async () => {
    try {
      const data = await adminListCollections()
      setCollections(data)
      if (!collection && data.length > 0) setCollection(data[0])
    } catch {
      setCollections([])
    }
  }, [collection])

  const loadRows = useCallback(async () => {
    if (!collection) return
    setLoading(true)
    try {
      const data = await adminListCollectionDocs(collection, search, page, SIZE)
      setRows(data.items || [])
      setTotal(data.total || 0)
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [collection, search, page])

  useEffect(() => { loadCollections() }, [loadCollections])
  useEffect(() => { setPage(0) }, [collection])
  useEffect(() => { loadRows() }, [loadRows])

  const idToString = (row: AdminCollectionDoc) => {
    const raw = row._id as any
    if (typeof raw === "string") return raw
    if (raw && typeof raw === "object") {
      if (raw.$oid) return String(raw.$oid)
      if (raw.oid) return String(raw.oid)
      if (raw.id) return String(raw.id)
      try {
        return JSON.stringify(raw)
      } catch {
      }
    }
    return String(raw)
  }

  const beginEdit = (row: AdminCollectionDoc) => {
    setEditingId(idToString(row))
    setEditJson(JSON.stringify(row, null, 2))
    setEditorError(null)
    setEditorOpen(true)
  }

  const saveEdit = async () => {
    if (!editingId || !collection) return
    let parsed: unknown
    try {
      parsed = JSON.parse(editJson)
    } catch {
      setEditorError("Invalid JSON format. Please fix syntax before saving.")
      return
    }

    setSavingEditor(true)
    setEditorError(null)
    try {
      await adminUpdateCollectionDoc(collection, editingId, parsed as Record<string, unknown>)
      setEditorOpen(false)
      setEditingId(null)
      setEditJson("")
      loadRows()
    } catch (error: any) {
      setEditorError(error?.message || "Failed to update document")
    } finally {
      setSavingEditor(false)
    }
  }

  const removeDoc = async (row: AdminCollectionDoc) => {
    if (!collection) return
    if (!confirm("Delete this document?")) return
    try {
      await adminDeleteCollectionDoc(collection, idToString(row))
      loadRows()
    } catch {}
  }

  const totalPages = Math.ceil(total / SIZE)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={collection} onChange={(e) => setCollection(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
          {collections.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="pl-10" placeholder="Search JSON fields..." />
        </div>
        <p className="text-sm text-muted-foreground">{total} docs</p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">_id</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Document</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-6"><Skeleton className="h-5 w-full" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No documents found</td></tr>
              ) : rows.map((row, rowIndex) => (
                <tr key={`${idToString(row)}::${rowIndex}`} className="border-b border-border align-top">
                  <td className="px-4 py-3 font-mono text-xs">{idToString(row)}</td>
                  <td className="px-4 py-3">
                    <pre className="max-h-[220px] overflow-auto rounded-md bg-muted/40 p-2 text-xs">{JSON.stringify(row, null, 2)}</pre>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => beginEdit(row)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeDoc(row)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditingId(null)
            setEditorError(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              {collection ? `Collection: ${collection}` : "Collection"}
              {editingId ? ` | _id: ${editingId}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>JSON</Label>
            <Textarea
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              className="min-h-[420px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Keep valid JSON format. Full document update will be applied.</p>
          </div>

          {editorError && <p className="text-sm text-destructive">{editorError}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEditor || !editingId || !collection}>
              {savingEditor ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : "Save document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

