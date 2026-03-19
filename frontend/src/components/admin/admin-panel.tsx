import { useState, useEffect, useCallback } from "react"
import { useNavigate, Routes, Route, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LayoutDashboard, Users, Archive, Tag, ArrowLeft,
  Search, ChevronLeft, ChevronRight, Trash2, Edit, Shield,
  ShieldOff, Check, X, Loader2, BarChart3, Database, Save, History, RotateCcw
} from "lucide-react"
import {
  adminGetStats, adminListUsers, adminUpdateUser, adminDeleteUser,
  adminListCapsules, adminDeleteCapsule, adminListTags, adminDeleteTag,
  adminUpdateCapsule, adminUpdateTag, adminListCollections, adminListCollectionDocs,
  adminUpdateCollectionDoc, adminDeleteCollectionDoc, adminRestoreUser, adminBulkUsers,
  adminRestoreCapsule, adminBulkCapsules, adminCreateTag, adminBulkTags, adminListAuditLogs,
  type AdminUser, type AdminCapsule, type Tag as TagType, type AdminPagedResponse, type AdminCollectionDoc, type AdminAuditLog
} from "@/services/api"

/* ── Admin Layout ──────────────────────── */

export function AdminPanel() {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/capsules", label: "Capsules", icon: Archive },
    { path: "/admin/tags", label: "Tags", icon: Tag },
    { path: "/admin/audit", label: "Audit", icon: History },
    { path: "/admin/data", label: "Data", icon: Database },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-6 gap-1.5 text-muted-foreground -ml-3">
        <ArrowLeft className="h-4 w-4" /> Home
      </Button>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-7 w-7" /> Admin Panel
        </h1>
        <p className="mt-1 text-muted-foreground">Manage all application data.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path || (tab.path !== "/admin" && location.pathname.startsWith(tab.path))
          const Icon = tab.icon
          return (
            <Button
              key={tab.path}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(tab.path)}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </Button>
          )
        })}
      </div>

      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersTable />} />
        <Route path="capsules" element={<AdminCapsulesTable />} />
        <Route path="tags" element={<AdminTagsTable />} />
        <Route path="audit" element={<AdminAuditTable />} />
        <Route path="data" element={<AdminDataTable />} />
      </Routes>
    </div>
  )
}

/* ── Dashboard ─────────────────────────── */

function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: "Total Users", key: "users", icon: Users, color: "text-blue-500 bg-blue-500/10" },
    { label: "Total Capsules", key: "capsules", icon: Archive, color: "text-emerald-500 bg-emerald-500/10" },
    { label: "Total Tags", key: "tags", icon: Tag, color: "text-purple-500 bg-purple-500/10" },
  ]

  return (
    <div>
      <h2 className="mb-4 font-serif text-xl font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> Overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.key} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {loading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-card-foreground">{stats?.[card.key] ?? 0}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Users Table ───────────────────────── */

function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [onlyBlocked, setOnlyBlocked] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("disable")
  const [bulkValue, setBulkValue] = useState("")
  const SIZE = 15

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

  const handleToggleEnabled = async (user: AdminUser) => {
    try {
      await adminUpdateUser(user.id, { enabled: !user.enabled })
      load()
    } catch {}
  }

  const handleSaveRole = async (id: string) => {
    try {
      await adminUpdateUser(id, { role: editRole })
      setEditingId(null)
      load()
    } catch {}
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
                      {editingId === user.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                            className="h-8 rounded border border-border bg-background px-2 text-xs"
                          >
                            <option value="regular">Regular</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveRole(user.id)}>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${
                            user.role === "admin"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                          onClick={() => { setEditingId(user.id); setEditRole(user.role) }}
                        >
                          {user.role === "admin" ? <Shield className="h-3 w-3 mr-1" /> : null}
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleEnabled(user)}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer bg-transparent border-none shadow-none ${
                          user.enabled
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {user.status || (user.enabled ? "active" : "disabled")}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.deletedAt ? (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRestore(user.id)}>
                          <RotateCcw className="h-4 w-4 text-emerald-500" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState("delete")
  const [bulkValue, setBulkValue] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editVisibility, setEditVisibility] = useState("private")
  const [editStatus, setEditStatus] = useState("draft")
  const [editAllowComments, setEditAllowComments] = useState(false)
  const [editAllowReactions, setEditAllowReactions] = useState(false)
  const SIZE = 15

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
    setEditingId(capsule.id)
    setEditTitle(capsule.title || "")
    setEditVisibility(capsule.visibility || "private")
    setEditStatus(capsule.status || "draft")
    setEditAllowComments(!!capsule.allowComments)
    setEditAllowReactions(!!capsule.allowReactions)
  }

  const saveEdit = async (id: string) => {
    try {
      await adminUpdateCapsule(id, {
        title: editTitle,
        visibility: editVisibility,
        status: editStatus,
        allowComments: editAllowComments,
        allowReactions: editAllowReactions,
      })
      setEditingId(null)
      load()
    } catch {}
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
                        {editingId === capsule.id ? (
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 max-w-[230px]" />
                        ) : (
                          <p className="font-medium text-foreground truncate max-w-[200px]">{capsule.title}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === capsule.id ? (
                        <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="h-8 rounded border border-border bg-background px-2 text-xs">
                          <option value="draft">draft</option>
                          <option value="sealed">sealed</option>
                          <option value="opened">opened</option>
                        </select>
                      ) : (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(capsule.status)}`}>
                          {capsule.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {editingId === capsule.id ? (
                        <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)} className="h-8 rounded border border-border bg-background px-2 text-xs">
                          <option value="private">private</option>
                          <option value="public">public</option>
                          <option value="shared">shared</option>
                        </select>
                      ) : (
                        capsule.visibility
                      )}
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
                      {editingId === capsule.id ? (
                        <div className="inline-flex items-center gap-1">
                          <label className="text-[11px] text-muted-foreground mr-1 inline-flex items-center gap-1">
                            <input type="checkbox" checked={editAllowComments} onChange={(e) => setEditAllowComments(e.target.checked)} /> comments
                          </label>
                          <label className="text-[11px] text-muted-foreground mr-2 inline-flex items-center gap-1">
                            <input type="checkbox" checked={editAllowReactions} onChange={(e) => setEditAllowReactions(e.target.checked)} /> reactions
                          </label>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(capsule.id)}>
                            <Save className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
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
                      )}
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
    </div>
  )
}

/* ── Tags Table ────────────────────────── */

function AdminTagsTable() {
  const [tags, setTags] = useState<TagType[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editImageUrl, setEditImageUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [newImageUrl, setNewImageUrl] = useState("")
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
  }

  const saveEdit = async (id: string) => {
    try {
      await adminUpdateTag(id, { name: editName, imageUrl: editImageUrl || null })
      setEditingId(null)
      load()
    } catch {}
  }

  const createNewTag = async () => {
    if (!newName.trim()) return
    try {
      await adminCreateTag({ name: newName.trim(), imageUrl: newImageUrl.trim() || null })
      setNewName("")
      setNewImageUrl("")
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
        <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="h-9 w-[260px]" placeholder="/static/tags/custom.jpg" />
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
                        {editingId === tag.id ? (
                          <div className="flex flex-col gap-1">
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-[180px]" />
                            <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} className="h-8 w-[220px]" placeholder="/uploads/tags/file.jpg" />
                          </div>
                        ) : (
                          <p className="font-medium text-foreground">{tag.name}</p>
                        )}
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
                      {editingId === tag.id ? (
                        <div className="inline-flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(tag.id)}>
                            <Save className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(tag)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(tag.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editJson, setEditJson] = useState("")
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
    if (raw && typeof raw === "object" && raw.$oid) return raw.$oid
    return String(raw)
  }

  const beginEdit = (row: AdminCollectionDoc) => {
    setEditingId(idToString(row))
    setEditJson(JSON.stringify(row, null, 2))
  }

  const saveEdit = async () => {
    if (!editingId || !collection) return
    try {
      const parsed = JSON.parse(editJson)
      await adminUpdateCollectionDoc(collection, editingId, parsed)
      setEditingId(null)
      loadRows()
    } catch {}
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
              ) : rows.map((row) => (
                <tr key={idToString(row)} className="border-b border-border align-top">
                  <td className="px-4 py-3 font-mono text-xs">{idToString(row)}</td>
                  <td className="px-4 py-3">
                    {editingId === idToString(row) ? (
                      <textarea value={editJson} onChange={(e) => setEditJson(e.target.value)} className="min-h-[180px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs" />
                    ) : (
                      <pre className="max-h-[220px] overflow-auto rounded-md bg-muted/40 p-2 text-xs">{JSON.stringify(row, null, 2)}</pre>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === idToString(row) ? (
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}><Save className="h-4 w-4 text-emerald-500" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => beginEdit(row)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeDoc(row)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
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
    </div>
  )
}

