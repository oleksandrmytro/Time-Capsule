import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  adminBulkUsers,
  adminCreateUser,
  adminDeleteCapsule,
  adminDeleteCollectionDoc,
  adminDeleteUser,
  adminImpersonateUser,
  adminListAuditLogs,
  adminListCollectionDocs,
  adminListUsers,
  adminRestoreUser,
  adminSendTemporaryPassword,
  type AdminAuditLog,
  type AdminCollectionDoc,
  type AdminUser,
} from "@/services/api"
import { resolveAssetUrl } from "@/lib/asset-url"
import { Ban, ChevronLeft, ChevronRight, Eye, FileDown, Filter, LogIn, Search, Shield, Trash2, UserCog, UserPlus } from "lucide-react"

type UserStatus = "active" | "blocked" | "pending" | "disabled" | "deleted"
type UserBulkAction = "disable" | "enable" | "delete" | "restore" | "role" | "block" | "unblock"

const HEX_ID_EXTRACT_RE = /[a-fA-F0-9]{24}/
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/
const adminSelectTriggerClass =
  "w-full justify-between border-white/15 bg-[#111827] text-sm text-slate-100 hover:bg-slate-900/70 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-400/15 data-[placeholder]:text-slate-400"
const adminSelectTriggerCompactClass =
  "h-9 min-w-[160px] justify-between border-white/15 bg-[#111827] px-2 text-xs text-slate-100 hover:bg-slate-900/70 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-400/15 data-[placeholder]:text-slate-400"
const adminSelectContentClass =
  "border-white/15 bg-[#111827] text-slate-100 shadow-2xl"
const adminSelectItemClass =
  "text-slate-100 focus:bg-cyan-400/15 focus:text-cyan-50 data-[state=checked]:bg-cyan-500/10 data-[state=checked]:text-cyan-100"

function statusOf(user: AdminUser): UserStatus {
  const status = String(user.status || "").toLowerCase()
  if (status === "deleted" || !!user.deletedAt) return "deleted"
  if (status === "pending") return "pending"
  if (status === "blocked") return "blocked"
  if (user.blockedUntil) {
    const ts = new Date(user.blockedUntil).getTime()
    if (!Number.isNaN(ts) && ts > Date.now()) return "blocked"
  }
  return user.enabled ? "active" : "disabled"
}

function statusClass(status: UserStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
    case "blocked":
      return "border-red-300/35 bg-red-500/15 text-red-100"
    case "pending":
      return "border-amber-300/35 bg-amber-500/15 text-amber-100"
    case "deleted":
      return "border-slate-300/35 bg-slate-500/18 text-slate-200"
    default:
      return "border-orange-300/35 bg-orange-500/15 text-orange-100"
  }
}

function statusLabel(status: UserStatus): string {
  switch (status) {
    case "blocked":
      return "Banned"
    case "pending":
      return "Pending"
    case "deleted":
      return "Deleted"
    case "disabled":
      return "Disabled"
    default:
      return "Active"
  }
}

function oid(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") {
    const matched = value.match(HEX_ID_EXTRACT_RE)
    return matched ? matched[0] : value
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>
    if (typeof rec.$oid === "string") return rec.$oid
    if (typeof rec.oid === "string") return rec.oid
    if (typeof rec.id === "string") return rec.id
    if (typeof rec.hexString === "string") return rec.hexString
    if (typeof rec.value === "string") return rec.value
    if (rec._id) return oid(rec._id)
  }
  const raw = String(value)
  const matched = raw.match(HEX_ID_EXTRACT_RE)
  return matched ? matched[0] : raw
}

function extractCapsuleIdFromDoc(rec: Record<string, unknown>): string {
  const capsule = rec.capsule && typeof rec.capsule === "object" ? (rec.capsule as Record<string, unknown>) : null
  const details = rec.details && typeof rec.details === "object" ? (rec.details as Record<string, unknown>) : null
  const entity = rec.entity && typeof rec.entity === "object" ? (rec.entity as Record<string, unknown>) : null
  const candidates: unknown[] = [
    rec.capsuleId,
    rec.targetId,
    rec.entityId,
    rec.referenceId,
    details?.capsuleId,
    details?.targetId,
    entity?.capsuleId,
    entity?.id,
    capsule?._id,
    capsule?.id,
  ]
  for (const candidate of candidates) {
    const value = oid(candidate)
    if (OBJECT_ID_RE.test(value)) return value
  }
  return ""
}

function recordOf(doc: AdminCollectionDoc): Record<string, unknown> {
  return doc as Record<string, unknown>
}

function collectionDocId(doc: AdminCollectionDoc): string {
  const rec = recordOf(doc)
  return oid(rec._id ?? rec.id ?? rec.value)
}

function formatDate(value: unknown): string {
  if (!value) return "-"
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message
  }
  return fallback
}

export function AdminUsersWorkspace() {
  const navigate = useNavigate()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "regular">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all")
  const [filtersOpen, setFiltersOpen] = useState(true)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<UserBulkAction>("disable")
  const [bulkValue, setBulkValue] = useState("")

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCapsules, setDetailCapsules] = useState<AdminCollectionDoc[]>([])
  const [detailMessages, setDetailMessages] = useState<AdminCollectionDoc[]>([])
  const [detailComments, setDetailComments] = useState<AdminCollectionDoc[]>([])
  const [detailReactions, setDetailReactions] = useState<AdminCollectionDoc[]>([])
  const [detailActivity, setDetailActivity] = useState<AdminAuditLog[]>([])

  const [issuingTempPassword, setIssuingTempPassword] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const [createUsername, setCreateUsername] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createRole, setCreateRole] = useState<"regular" | "admin">("regular")
  const [createEnabled, setCreateEnabled] = useState(true)

  const [actionError, setActionError] = useState<string | null>(null)
  const usersRequestSeqRef = useRef(0)
  const SIZE = 15

  const loadUsers = useCallback(async (): Promise<AdminUser[]> => {
    const requestSeq = ++usersRequestSeqRef.current
    setLoading(true)
    try {
      const res = await adminListUsers(search, page, SIZE, roleFilter, statusFilter)
      if (requestSeq !== usersRequestSeqRef.current) return []
      const items = res.items || []
      setUsers(items)
      setTotal(res.total || 0)
      return items
    } catch {
      if (requestSeq !== usersRequestSeqRef.current) return []
      setUsers([])
      setTotal(0)
      return []
    } finally {
      if (requestSeq === usersRequestSeqRef.current) {
        setLoading(false)
      }
    }
  }, [page, search, statusFilter, roleFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => users.some((user) => user.id === id)))
  }, [users])

  const loadDetail = async (user: AdminUser) => {
    setDetailLoading(true)
    try {
      const [capsulesRes, messagesRes, commentsRes, reactionsRes, activityRes] = await Promise.all([
        adminListCollectionDocs("capsules", "", 0, 1000).catch(() => ({ items: [] as AdminCollectionDoc[], total: 0, page: 0, size: 0 })),
        adminListCollectionDocs("chat_messages", "", 0, 1000).catch(() => ({ items: [] as AdminCollectionDoc[], total: 0, page: 0, size: 0 })),
        adminListCollectionDocs("comments", "", 0, 1000).catch(() => ({ items: [] as AdminCollectionDoc[], total: 0, page: 0, size: 0 })),
        adminListCollectionDocs("reactions", "", 0, 1000).catch(() => ({ items: [] as AdminCollectionDoc[], total: 0, page: 0, size: 0 })),
        adminListAuditLogs(user.email || user.id, 0, 40).catch(() => ({ items: [] as AdminAuditLog[], total: 0, page: 0, size: 0 })),
      ])

      const ownedCapsules = (capsulesRes.items || []).filter((doc) => oid(recordOf(doc).ownerId) === user.id)
      const ownedCapsuleIds = new Set(ownedCapsules.map((doc) => collectionDocId(doc)))

      setDetailCapsules(ownedCapsules.slice(0, 40))
      setDetailMessages((messagesRes.items || []).filter((doc) => {
        const from = oid(recordOf(doc).fromUserId)
        const to = oid(recordOf(doc).toUserId)
        return from === user.id || to === user.id
      }).slice(0, 50))
      setDetailComments((commentsRes.items || []).filter((doc) => {
        const authorId = oid(recordOf(doc).userId)
        const capsuleId = extractCapsuleIdFromDoc(recordOf(doc))
        return authorId === user.id || ownedCapsuleIds.has(capsuleId)
      }).slice(0, 80))
      setDetailReactions((reactionsRes.items || []).filter((doc) => {
        const actorId = oid(recordOf(doc).userId)
        const capsuleId = extractCapsuleIdFromDoc(recordOf(doc))
        return actorId === user.id || ownedCapsuleIds.has(capsuleId)
      }).slice(0, 80))
      setDetailActivity((activityRes.items || []).slice(0, 40))
    } finally {
      setDetailLoading(false)
    }
  }

  const openDetail = (user: AdminUser) => {
    setDetailUser(user)
    setDetailOpen(true)
    void loadDetail(user)
  }

  const refresh = async () => {
    const latestUsers = await loadUsers()
    if (!detailUser) return
    const nextUser = latestUsers.find((u) => u.id === detailUser.id) || detailUser
    setDetailUser(nextUser)
    await loadDetail(nextUser)
  }

  const quickBanToggle = async (user: AdminUser) => {
    setActionError(null)
    try {
      const action = statusOf(user) === "blocked" ? "unblock" : "block"
      await adminBulkUsers([user.id], action)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to change ban status"))
    }
  }

  const quickEnableToggle = async (user: AdminUser) => {
    setActionError(null)
    try {
      const action = user.enabled ? "disable" : "enable"
      await adminBulkUsers([user.id], action)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to change account status"))
    }
  }

  const toggleRole = async (user: AdminUser) => {
    setActionError(null)
    try {
      const nextRole = String(user.role || "").toLowerCase() === "admin" ? "regular" : "admin"
      await adminBulkUsers([user.id], "role", nextRole)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to change role"))
    }
  }

  const removeUser = async (id: string) => {
    if (!confirm("Soft delete this user?")) return
    setActionError(null)
    try {
      await adminDeleteUser(id)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to delete user"))
    }
  }

  const restoreUser = async (id: string) => {
    setActionError(null)
    try {
      await adminRestoreUser(id)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to restore user"))
    }
  }

  const applyBulk = async () => {
    if (selectedIds.length === 0) return
    setActionError(null)
    try {
      await adminBulkUsers(selectedIds, bulkAction, bulkValue || undefined)
      setSelectedIds([])
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to apply bulk action"))
    }
  }

  const setUserBulkAction = (nextAction: UserBulkAction) => {
    setBulkAction(nextAction)
    if (nextAction === "role") {
      setBulkValue("regular")
      return
    }
    setBulkValue("")
  }

  const issueTemporaryPassword = async () => {
    if (!detailUser) return
    setActionError(null)
    setIssuingTempPassword(true)
    try {
      await adminSendTemporaryPassword(detailUser.id)
    } catch (error) {
      setActionError(errorMessage(error, "Failed to send temporary password"))
    } finally {
      setIssuingTempPassword(false)
    }
  }

  const loginAsUser = async () => {
    if (!detailUser) return
    if (!confirm(`Login as @${detailUser.username || detailUser.email}?`)) return
    setActionError(null)
    setImpersonating(true)
    try {
      await adminImpersonateUser(detailUser.id)
      const destination = detailUser.username ? `/profile/${encodeURIComponent(detailUser.username)}` : "/"
      window.location.assign(destination)
    } catch (error) {
      setActionError(errorMessage(error, "Failed to impersonate this user"))
      setImpersonating(false)
    }
  }

  const openCapsule = (capsuleId: string) => {
    if (!OBJECT_ID_RE.test(capsuleId)) {
      setActionError("Invalid capsule id in record")
      return
    }
    navigate(`/capsules/${encodeURIComponent(capsuleId)}`)
  }

  const deleteCapsule = async (capsuleId: string) => {
    if (!capsuleId || !confirm("Delete this capsule?")) return
    setActionError(null)
    try {
      await adminDeleteCapsule(capsuleId)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, "Failed to delete capsule"))
    }
  }

  const deleteCollectionItem = async (collection: string, doc: AdminCollectionDoc, label: string) => {
    const docId = collectionDocId(doc)
    if (!docId || !confirm(`Delete this ${label}?`)) return
    setActionError(null)
    try {
      await adminDeleteCollectionDoc(collection, docId)
      await refresh()
    } catch (error) {
      setActionError(errorMessage(error, `Failed to delete ${label}`))
    }
  }

  const openCreateUserDialog = () => {
    setCreateUserError(null)
    setCreateUsername("")
    setCreateEmail("")
    setCreatePassword("")
    setCreateRole("regular")
    setCreateEnabled(true)
    setCreateUserOpen(true)
  }

  const createUser = async () => {
    if (!createUsername.trim() || !createEmail.trim() || !createPassword.trim()) {
      setCreateUserError("Username, email and password are required.")
      return
    }
    setCreatingUser(true)
    setCreateUserError(null)
    try {
      await adminCreateUser({
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
        enabled: createEnabled,
      })
      setCreateUserOpen(false)
      await refresh()
    } catch (error) {
      setCreateUserError(errorMessage(error, "Failed to create user"))
    } finally {
      setCreatingUser(false)
    }
  }

  const exportCsv = () => {
    const rows = users.map((u) => [u.id, u.username || "", u.email || "", u.role || "", statusOf(u), u.createdAt || ""])
    const lines = [["id", "username", "email", "role", "status", "createdAt"], ...rows]
    const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const csv = lines.map((row) => row.map(esc).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `admin-users-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / SIZE)
  const filtersButtonClass = filtersOpen
    ? "border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
    : "border border-white/15 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2.5">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Users</h2>
          <p className="text-xs text-slate-400">Control center for account management.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openCreateUserDialog} className="border border-cyan-300/25 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Create user
          </Button>
          <Button size="sm" variant="ghost" onClick={exportCsv} className="border border-white/15 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70">
            <FileDown className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setFiltersOpen((v) => !v)} className={filtersButtonClass}>
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search users, emails..."
            className="border-white/15 bg-slate-900/50 pl-10 text-slate-100 placeholder:text-slate-500"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
        </div>
        <p className="text-sm text-slate-400">{loading ? "Loading..." : `${users.length} shown - ${total} total`}</p>
      </div>

      {filtersOpen ? (
        <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-900/45 p-3 md:grid-cols-3">
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              setRoleFilter(value as "all" | "admin" | "regular")
              setPage(0)
            }}
          >
            <SelectTrigger className={adminSelectTriggerClass}>
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent className={adminSelectContentClass}>
              <SelectItem value="all" className={adminSelectItemClass}>All roles</SelectItem>
              <SelectItem value="admin" className={adminSelectItemClass}>Admin</SelectItem>
              <SelectItem value="regular" className={adminSelectItemClass}>Regular</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as "all" | UserStatus)
              setPage(0)
            }}
          >
            <SelectTrigger className={adminSelectTriggerClass}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className={adminSelectContentClass}>
              <SelectItem value="all" className={adminSelectItemClass}>All statuses</SelectItem>
              <SelectItem value="active" className={adminSelectItemClass}>Active</SelectItem>
              <SelectItem value="blocked" className={adminSelectItemClass}>Banned</SelectItem>
              <SelectItem value="pending" className={adminSelectItemClass}>Pending</SelectItem>
              <SelectItem value="disabled" className={adminSelectItemClass}>Disabled</SelectItem>
              <SelectItem value="deleted" className={adminSelectItemClass}>Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            className="h-10 border border-white/15 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70"
            onClick={() => {
              setRoleFilter("all")
              setStatusFilter("all")
              setSearch("")
              setPage(0)
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/45 p-3">
        <Select value={bulkAction} onValueChange={(value) => setUserBulkAction(value as UserBulkAction)}>
          <SelectTrigger className={adminSelectTriggerCompactClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={adminSelectContentClass}>
            <SelectItem value="disable" className={adminSelectItemClass}>Disable</SelectItem>
            <SelectItem value="enable" className={adminSelectItemClass}>Enable</SelectItem>
            <SelectItem value="delete" className={adminSelectItemClass}>Soft delete</SelectItem>
            <SelectItem value="restore" className={adminSelectItemClass}>Restore</SelectItem>
            <SelectItem value="role" className={adminSelectItemClass}>Set role</SelectItem>
            <SelectItem value="block" className={adminSelectItemClass}>Block until date</SelectItem>
            <SelectItem value="unblock" className={adminSelectItemClass}>Unblock</SelectItem>
          </SelectContent>
        </Select>
        {bulkAction === "role" ? (
          <Select value={bulkValue || "regular"} onValueChange={setBulkValue}>
            <SelectTrigger className={`${adminSelectTriggerCompactClass} w-[220px]`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={adminSelectContentClass}>
              <SelectItem value="regular" className={adminSelectItemClass}>regular</SelectItem>
              <SelectItem value="admin" className={adminSelectItemClass}>admin</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {bulkAction === "block" ? (
          <Input
            type="datetime-local"
            className="h-9 w-[220px] border-white/15 bg-[#111827] text-slate-100 placeholder:text-slate-500 [color-scheme:dark]"
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
          />
        ) : null}
        <Button size="sm" className="border border-cyan-300/25 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/35" disabled={selectedIds.length === 0} onClick={applyBulk}>
          Apply bulk ({selectedIds.length})
        </Button>
      </div>

      {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/35">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1527]">
                <th className="px-4 py-3 text-left text-slate-400">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.length === users.length}
                    onChange={(event) => setSelectedIds(event.target.checked ? users.map((u) => u.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 text-left text-slate-400">User</th>
                <th className="px-4 py-3 text-left text-slate-400">Email</th>
                <th className="px-4 py-3 text-left text-slate-400">Role</th>
                <th className="px-4 py-3 text-left text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-slate-400">Created</th>
                <th className="px-4 py-3 text-right text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-white/10">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-5 w-full bg-white/10" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No users found</td>
                </tr>
              ) : (
                users.map((user) => {
                  const userStatus = statusOf(user)
                  const blocked = userStatus === "blocked"
                  const deleted = userStatus === "deleted"
                  return (
                    <tr key={user.id} className="cursor-pointer border-b border-white/10 transition-colors hover:bg-slate-800/45" onClick={() => openDetail(user)}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={(event) =>
                            setSelectedIds((prev) => event.target.checked ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id))
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={resolveAssetUrl(user.avatarUrl)} alt={user.username || user.email || "user"} />
                            <AvatarFallback className="bg-slate-700 text-xs font-bold text-slate-100">
                              {(user.username || user.email || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-100">{user.username || "-"}</p>
                            <p className="text-xs text-slate-400">{user.email || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${String(user.role || "").toLowerCase() === "admin" ? "border-violet-300/35 bg-violet-500/15 text-violet-100" : "border-slate-300/35 bg-slate-500/18 text-slate-100"}`}>
                          {String(user.role || "").toLowerCase() === "admin" ? <Shield className="mr-1 h-3 w-3" /> : null}
                          {String(user.role || "").toLowerCase() === "admin" ? "Admin" : "User"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(userStatus)}`}>
                          {statusLabel(userStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-slate-100" onClick={(event) => { event.stopPropagation(); openDetail(user) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!deleted ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={blocked ? "Unban user" : "Ban user"}
                              className={`h-8 w-8 ${blocked ? "text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100" : "text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"}`}
                              onClick={(event) => { event.stopPropagation(); void quickBanToggle(user) }}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {!deleted ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={user.enabled ? "Disable account" : "Enable account"}
                              className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-slate-100"
                              onClick={(event) => { event.stopPropagation(); void quickEnableToggle(user) }}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {deleted ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-100" onClick={(event) => { event.stopPropagation(); void restoreUser(user.id) }}>
                              <UserCog className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-300 hover:bg-red-500/20 hover:text-red-100" onClick={(event) => { event.stopPropagation(); void removeUser(user.id) }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm text-slate-400">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10" disabled={page >= totalPages - 1} onClick={() => setPage((prev) => prev + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-hidden border-l border-white/10 bg-[#0F172A] p-0 text-slate-100 antialiased [text-rendering:optimizeLegibility] shadow-[-20px_0_60px_rgba(2,6,23,0.55)] sm:max-w-3xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-right-6 data-[state=closed]:slide-out-to-right-6 data-[state=open]:duration-500 data-[state=closed]:duration-350"
        >
          <SheetHeader className="border-b border-white/10 bg-[#111827] px-5 py-4">
            <SheetTitle className="text-slate-100">User Detail</SheetTitle>
            <SheetDescription className="text-slate-300">{detailUser ? `@${detailUser.username || detailUser.email}` : "User details"}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-3 text-slate-200 sm:px-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-300">
            {detailUser ? (
              <Tabs defaultValue="capsules" className="w-full animate-in fade-in-0 duration-300">
                <TabsList className="grid h-auto w-full grid-cols-3 auto-rows-fr content-start gap-x-1 gap-y-2 bg-slate-800/65 p-1.5 text-slate-200 md:grid-cols-6 md:gap-y-1">
                  <TabsTrigger value="capsules" className="min-w-0 text-xs sm:text-sm">Capsules</TabsTrigger>
                  <TabsTrigger value="comments" className="min-w-0 text-xs sm:text-sm">Comments</TabsTrigger>
                  <TabsTrigger value="reactions" className="min-w-0 text-xs sm:text-sm">Reactions</TabsTrigger>
                  <TabsTrigger value="messages" className="min-w-0 text-xs sm:text-sm">Messages</TabsTrigger>
                  <TabsTrigger value="activity" className="min-w-0 text-xs sm:text-sm">Activity</TabsTrigger>
                  <TabsTrigger value="settings" className="min-w-0 text-xs sm:text-sm">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="capsules" className="space-y-2">
                  {detailLoading ? (
                    <Skeleton className="h-20 w-full bg-white/10" />
                  ) : detailCapsules.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-6 text-center text-sm text-slate-400">No capsules for this user.</p>
                  ) : (
                    detailCapsules.map((capsule, idx) => {
                      const rec = recordOf(capsule)
                      const capsuleId = collectionDocId(capsule)
                      return (
                        <div key={`${capsuleId}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-100">{String(rec.title || "Untitled capsule")}</p>
                              <p className="mt-1 text-xs text-slate-400">{String(rec.visibility || "private")} - {String(rec.status || "draft")}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-8 border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70" onClick={() => openCapsule(capsuleId)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Open
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 border border-red-300/25 bg-red-500/20 text-red-100 hover:bg-red-500/30" onClick={() => void deleteCapsule(capsuleId)}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="comments" className="space-y-2">
                  {detailLoading ? (
                    <Skeleton className="h-20 w-full bg-white/10" />
                  ) : detailComments.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-6 text-center text-sm text-slate-400">No comments related to this user.</p>
                  ) : (
                    detailComments.map((comment, idx) => {
                      const rec = recordOf(comment)
                      const capsuleId = extractCapsuleIdFromDoc(rec)
                      const authorId = oid(rec.userId)
                      const relation = authorId === detailUser.id ? "User wrote this comment" : "Comment on this user's capsule"
                      return (
                        <div key={`${collectionDocId(comment)}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-cyan-100">{relation}</p>
                            <p className="text-xs text-slate-400">{formatDate(rec.createdAt)}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-100">{String(rec.body || "Comment")}</p>
                          <div className="mt-2 flex items-center gap-1">
                            {capsuleId ? (
                              <Button size="sm" variant="ghost" className="h-8 border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70" onClick={() => openCapsule(capsuleId)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Open capsule
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" className="h-8 border border-red-300/25 bg-red-500/20 text-red-100 hover:bg-red-500/30" onClick={() => void deleteCollectionItem("comments", comment, "comment")}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="reactions" className="space-y-2">
                  {detailLoading ? (
                    <Skeleton className="h-20 w-full bg-white/10" />
                  ) : detailReactions.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-6 text-center text-sm text-slate-400">No reactions related to this user.</p>
                  ) : (
                    detailReactions.map((reaction, idx) => {
                      const rec = recordOf(reaction)
                      const capsuleId = extractCapsuleIdFromDoc(rec)
                      const actorId = oid(rec.userId)
                      const relation = actorId === detailUser.id ? "User left this reaction" : "Reaction received on this user's capsule"
                      return (
                        <div key={`${collectionDocId(reaction)}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-cyan-100">{relation}</p>
                            <p className="text-xs text-slate-400">{formatDate(rec.createdAt)}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-100">Type: {String(rec.type || "reaction")}</p>
                          <div className="mt-2 flex items-center gap-1">
                            {capsuleId ? (
                              <Button size="sm" variant="ghost" className="h-8 border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70" onClick={() => openCapsule(capsuleId)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Open capsule
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" className="h-8 border border-red-300/25 bg-red-500/20 text-red-100 hover:bg-red-500/30" onClick={() => void deleteCollectionItem("reactions", reaction, "reaction")}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="messages" className="space-y-2">
                  {detailLoading ? (
                    <Skeleton className="h-20 w-full bg-white/10" />
                  ) : detailMessages.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-6 text-center text-sm text-slate-400">No messages for this user.</p>
                  ) : (
                    detailMessages.map((message, idx) => {
                      const rec = recordOf(message)
                      const capsuleId = oid(rec.capsuleId)
                      const text = String(rec.text || rec.capsuleTitle || "Media message")
                      return (
                        <div key={`${collectionDocId(message)}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5">
                          <p className="text-xs text-slate-400">{formatDate(rec.createdAt)}</p>
                          <p className="mt-1 text-sm text-slate-100">{text}</p>
                          <div className="mt-2 flex items-center gap-1">
                            {capsuleId ? (
                              <Button size="sm" variant="ghost" className="h-8 border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70" onClick={() => openCapsule(capsuleId)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Open capsule
                              </Button>
                            ) : null}
                            <Button size="sm" variant="ghost" className="h-8 border border-red-300/25 bg-red-500/20 text-red-100 hover:bg-red-500/30" onClick={() => void deleteCollectionItem("chat_messages", message, "message")}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-2">
                  {detailLoading ? (
                    <Skeleton className="h-20 w-full bg-white/10" />
                  ) : detailActivity.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-6 text-center text-sm text-slate-400">No activity.</p>
                  ) : (
                    detailActivity.map((log) => (
                      <div key={log.id} className="rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-cyan-100">{log.action}</p>
                          <p className="text-xs text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{log.entityType}:{log.entityId || "-"}</p>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="settings" className="mt-3">
                  {(() => {
                    const currentStatus = statusOf(detailUser)
                    const canOpenProfile = !!detailUser.username
                    const isDeleted = currentStatus === "deleted"
                    const isBlocked = currentStatus === "blocked"
                    const roleName = String(detailUser.role || "regular")
                    const latestActivity = detailActivity[0]
                    const actionButtonClass = "h-10 justify-start px-3 text-[13px] font-medium"
                    const statTileClass = "flex min-h-12 items-center justify-between rounded-md border border-white/10 bg-slate-900/50 px-2.5 py-2 text-slate-300"
                    return (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/12 bg-slate-900/40 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.08em] text-slate-300">Account overview</p>
                              <p className="mt-1 text-sm font-semibold text-slate-100">@{detailUser.username || "unknown"}</p>
                              <p className="text-xs text-slate-300">{detailUser.email || "No email"}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(currentStatus)}`}>
                                {statusLabel(currentStatus)}
                              </span>
                              <span className="rounded-full border border-white/15 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-200">
                                Role: {roleName}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
                          <div className="space-y-3 xl:flex xl:flex-col">
                            <div className="rounded-xl border border-white/10 bg-slate-900/35 p-3.5">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200">
                                  <Shield className="h-3.5 w-3.5 text-cyan-200" />
                                  Account Control
                                </p>
                                <p className="text-xs text-slate-300">Primary actions</p>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {isDeleted ? (
                                  <Button className={`${actionButtonClass} border border-emerald-300/25 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30`} onClick={() => void restoreUser(detailUser.id)}>
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Restore user
                                  </Button>
                                ) : (
                                  <Button className={`${actionButtonClass} ${isBlocked ? "border border-emerald-300/25 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30" : "border border-amber-300/25 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"}`} onClick={() => void quickBanToggle(detailUser)}>
                                    <Ban className="mr-2 h-4 w-4" />
                                    {isBlocked ? "Unban user" : "Ban user"}
                                  </Button>
                                )}

                                {isDeleted ? (
                                  <Button disabled className={`${actionButtonClass} border border-white/10 bg-slate-900/35 text-slate-500`}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    User already deleted
                                  </Button>
                                ) : (
                                  <Button className={`${actionButtonClass} border border-red-300/25 bg-red-500/20 text-red-100 hover:bg-red-500/30`} onClick={() => void removeUser(detailUser.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete user
                                  </Button>
                                )}

                                <Button className={`${actionButtonClass} border border-violet-300/25 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`} onClick={() => void toggleRole(detailUser)}>
                                  <UserCog className="mr-2 h-4 w-4" />
                                  {String(detailUser.role || "").toLowerCase() === "admin" ? "Set regular role" : "Set admin role"}
                                </Button>

                                {isDeleted ? (
                                  <Button disabled className={`${actionButtonClass} border border-white/10 bg-slate-900/35 text-slate-500`}>
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Account is deleted
                                  </Button>
                                ) : (
                                  <Button className={`${actionButtonClass} border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70`} onClick={() => void quickEnableToggle(detailUser)}>
                                    <UserCog className="mr-2 h-4 w-4" />
                                    {detailUser.enabled ? "Disable account" : "Enable account"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-slate-900/35 p-3.5 xl:flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-200">Moderation snapshot</p>
                              <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                                <div className={statTileClass}>Capsules: <span className="font-semibold text-slate-100">{detailCapsules.length}</span></div>
                                <div className={statTileClass}>Messages: <span className="font-semibold text-slate-100">{detailMessages.length}</span></div>
                                <div className={statTileClass}>Comments: <span className="font-semibold text-slate-100">{detailComments.length}</span></div>
                                <div className={statTileClass}>Reactions: <span className="font-semibold text-slate-100">{detailReactions.length}</span></div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 xl:flex xl:flex-col">
                            <div className="rounded-xl border border-white/10 bg-slate-900/35 p-3.5">
                              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200">
                                <LogIn className="h-3.5 w-3.5 text-amber-200" />
                                Access And Support
                              </p>
                              <div className="grid gap-2">
                                <Button
                                  className={`${actionButtonClass} border border-cyan-300/25 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30`}
                                  onClick={() => void issueTemporaryPassword()}
                                  disabled={issuingTempPassword}
                                >
                                  <UserCog className="mr-2 h-4 w-4" />
                                  {issuingTempPassword ? "Sending temporary password..." : "Send temporary password"}
                                </Button>

                                <Button
                                  className={`${actionButtonClass} border border-amber-300/25 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`}
                                  onClick={() => void loginAsUser()}
                                  disabled={impersonating}
                                >
                                  <LogIn className="mr-2 h-4 w-4" />
                                  {impersonating ? "Starting impersonation..." : "Login as user"}
                                </Button>

                                <Button
                                  className={`${actionButtonClass} border border-white/15 bg-slate-800/55 text-slate-100 hover:bg-slate-700/70`}
                                  onClick={() => canOpenProfile && navigate(`/profile/${encodeURIComponent(detailUser.username || "")}`)}
                                  disabled={!canOpenProfile}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Open profile
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-slate-900/35 p-3.5 xl:flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-200">Recent activity</p>
                              {latestActivity ? (
                                <>
                                  <p className="mt-2 text-sm font-medium text-slate-100">{latestActivity.action}</p>
                                  <p className="text-xs text-slate-300">{latestActivity.createdAt ? new Date(latestActivity.createdAt).toLocaleString() : "-"}</p>
                                  <p className="mt-1 text-xs text-slate-300">{latestActivity.entityType}:{latestActivity.entityId || "-"}</p>
                                </>
                              ) : (
                                <p className="mt-2 text-sm text-slate-300">No recent activity for this user.</p>
                              )}
                              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                                <p className="text-xs text-slate-300">Account actions are here. Capsule, comment, and message moderation remains in the tabs above.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
                      </div>
                    )
                  })()}
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="border-white/10 bg-[#111827] text-slate-100">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a user directly from admin panel without public registration flow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={createUsername} onChange={(event) => setCreateUsername(event.target.value)} className="border-white/15 bg-slate-900/45 text-slate-100" placeholder="username" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} className="border-white/15 bg-slate-900/45 text-slate-100" placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} className="border-white/15 bg-slate-900/45 text-slate-100" placeholder="At least 8 characters" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={createRole} onValueChange={(value) => setCreateRole(value as "regular" | "admin")}>
                  <SelectTrigger className={adminSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={adminSelectContentClass}>
                    <SelectItem value="regular" className={adminSelectItemClass}>Regular</SelectItem>
                    <SelectItem value="admin" className={adminSelectItemClass}>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={createEnabled} onChange={(event) => setCreateEnabled(event.target.checked)} />
                Account enabled
              </label>
            </div>
            {createUserError ? <p className="text-sm text-rose-300">{createUserError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-200 hover:bg-white/10" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
            <Button className="border border-cyan-300/25 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/35" onClick={() => void createUser()} disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
