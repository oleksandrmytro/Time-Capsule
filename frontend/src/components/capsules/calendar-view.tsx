import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft, CalendarDays, Lock, Unlock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
} from "date-fns"
import { listCapsulesByDateRange, type Capsule } from "@/services/api"

interface CalendarViewProps {
  onSelectCapsule?: (id: string) => void
}

export function CalendarView({ onSelectCapsule }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const navigate = useNavigate()

  const loadCapsules = useCallback(async () => {
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
      const data = await listCapsulesByDateRange(calStart.toISOString(), calEnd.toISOString())
      setCapsules(Array.isArray(data) ? data : [])
    } catch {
      setCapsules([])
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    loadCapsules()
  }, [loadCapsules])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getCapsulesByDay = (day: Date) => {
    return capsules.filter((capsule) => isSameDay(new Date(capsule.unlockAt), day))
  }

  const selectedCapsules = selectedDate ? getCapsulesByDay(selectedDate) : []
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <section className="relative isolate min-h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#09111f] px-4 py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.23] blur-[0.8px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,34,0.56)_0%,rgba(8,16,36,0.7)_50%,rgba(8,17,38,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(94,230,255,0.18)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(124,92,255,0.18)_0%,rgba(124,92,255,0)_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(56,189,248,0.12)_0%,rgba(56,189,248,0)_38%)]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 -ml-3 gap-1.5 text-slate-200 hover:bg-white/[0.12] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="mb-6">
          <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight text-slate-100">
            <CalendarDays className="h-7 w-7 text-cyan-200" /> Capsule Calendar
          </h1>
          <p className="mt-1 text-slate-300">View when your capsules will unlock.</p>
        </div>

        <div className="rounded-2xl border border-white/18 bg-slate-900/68 shadow-[0_30px_80px_rgba(6,14,34,0.5)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/14 px-6 py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="text-slate-200 hover:bg-white/[0.12] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-serif text-lg font-semibold text-slate-100">{format(currentMonth, "MMMM yyyy")}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="text-slate-200 hover:bg-white/[0.12] hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-medium text-slate-300">
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-lg bg-white/[0.12]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const dayCapsules = getCapsulesByDay(day)
                  const inMonth = isSameMonth(day, currentMonth)
                  const today = isToday(day)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const sealedCount = dayCapsules.filter((capsule) => capsule.status === "sealed").length
                  const openedCount = dayCapsules.filter((capsule) => capsule.status === "opened").length

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(isSelected ? null : day)}
                      className={`relative flex min-h-[64px] cursor-pointer flex-col items-center gap-0.5 rounded-lg border p-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                        !inMonth ? "opacity-35" : ""
                      } ${
                        today ? "border-cyan-300/45" : "border-transparent"
                      } ${
                        isSelected
                          ? "border-cyan-200/75 bg-cyan-300/24 shadow-[0_0_0_1px_rgba(94,230,255,0.45),0_10px_22px_rgba(8,21,46,0.42)]"
                          : "bg-white/[0.04] hover:-translate-y-[1px] hover:border-cyan-200/65 hover:bg-[radial-gradient(circle_at_50%_40%,rgba(94,230,255,0.24)_0%,rgba(94,230,255,0.12)_60%)] hover:shadow-[0_0_0_1px_rgba(94,230,255,0.45),0_10px_24px_rgba(5,12,30,0.46)]"
                      }`}
                    >
                      <span className={`text-xs font-medium ${today ? "text-cyan-100" : inMonth ? "text-white" : "text-slate-400"}`}>
                        {format(day, "d")}
                      </span>
                      {dayCapsules.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-0.5">
                          {sealedCount > 0 && (
                            <span className="flex items-center gap-0.5 rounded-full border border-amber-300/30 bg-amber-400/16 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                              <Lock className="h-2.5 w-2.5" /> {sealedCount}
                            </span>
                          )}
                          {openedCount > 0 && (
                            <span className="flex items-center gap-0.5 rounded-full border border-emerald-300/30 bg-emerald-400/16 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                              <Unlock className="h-2.5 w-2.5" /> {openedCount}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedDate && (
            <div className="border-t border-white/14 p-4">
              <h3 className="mb-3 font-serif text-sm font-semibold text-slate-100">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              {selectedCapsules.length === 0 ? (
                <p className="text-sm text-slate-300">No capsules unlocking on this day.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedCapsules.map((capsule) => (
                    <button
                      key={capsule.id}
                      onClick={() => (onSelectCapsule ? onSelectCapsule(capsule.id) : navigate(`/capsules/${capsule.id}`))}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/16 bg-white/[0.08] p-3 text-left transition-colors hover:bg-white/[0.12]"
                    >
                      {capsule.coverImageUrl && (
                        <img src={capsule.coverImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{capsule.title}</p>
                        <p className="text-xs text-slate-300">
                          {capsule.status === "sealed" ? "Locked" : "Opened"} • {format(new Date(capsule.unlockAt), "h:mm a")}
                        </p>
                      </div>
                      {capsule.tags && capsule.tags.length > 0 && (
                        <div className="flex gap-1">
                          {capsule.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full border border-cyan-300/25 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Sealed (locked)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Opened
          </div>
        </div>
      </div>
    </section>
  )
}
