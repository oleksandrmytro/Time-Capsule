import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { adminListAuditLogs, type AdminAuditLog } from "@/services/api"
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react"

export function AdminAuditWorkspace() {
  const [rows, setRows] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [actorFilter, setActorFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
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

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (actorFilter && !(row.actorEmail || row.actorId || "").toLowerCase().includes(actorFilter.toLowerCase())) return false
    if (actionFilter && !(row.action || "").toLowerCase().includes(actionFilter.toLowerCase())) return false
    return true
  }), [rows, actorFilter, actionFilter])

  const totalPages = Math.ceil(total / SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2.5">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Audit</h2>
          <p className="text-xs text-slate-400">Actor, action, entity, and timestamp traceability.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setFiltersOpen((v) => !v)} className="border border-white/15 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70">
          <Filter className="mr-1.5 h-4 w-4" />
          Filters
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search action, entity, actor email..."
            className="border-white/15 bg-slate-900/50 pl-10 text-slate-100 placeholder:text-slate-500"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <p className="text-sm text-slate-400">{filteredRows.length} shown • {total} total</p>
      </div>

      {filtersOpen && (
        <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-900/45 p-3 md:grid-cols-3">
          <Input value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="Filter by actor email/id" className="border-white/15 bg-[#111827] text-slate-100 placeholder:text-slate-500" />
          <Input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="Filter by action" className="border-white/15 bg-[#111827] text-slate-100 placeholder:text-slate-500" />
          <Button variant="ghost" className="h-10 border border-white/15 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70" onClick={() => { setActorFilter(""); setActionFilter("") }}>
            Reset filters
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/35">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1527]">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Action</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full bg-white/10" /></td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit events found</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-white/10 align-top">
                  <td className="px-4 py-3 text-xs text-slate-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3 text-xs text-slate-200">{row.actorEmail || row.actorId || "-"}</td>
                  <td className="px-4 py-3"><span className="rounded border border-cyan-300/25 bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-100">{row.action}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-300">{row.entityType}:{row.entityId || "-"}</td>
                  <td className="px-4 py-3"><pre className="max-h-[140px] overflow-auto rounded-md border border-white/10 bg-slate-900/45 p-2 text-xs text-slate-300">{JSON.stringify(row.details || {}, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-slate-400">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
