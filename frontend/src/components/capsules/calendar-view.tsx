import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft, CalendarDays, Lock, Unlock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths,
  format, isSameMonth, isSameDay, isToday, eachDayOfInterval, parseISO
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
    return capsules.filter(c => {
      const unlockDate = new Date(c.unlockAt)
      return isSameDay(unlockDate, day)
    })
  }

  const selectedCapsules = selectedDate ? getCapsulesByDay(selectedDate) : []

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-1.5 text-muted-foreground -ml-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CalendarDays className="h-7 w-7" /> Capsule Calendar
        </h1>
        <p className="mt-1 text-muted-foreground">View when your capsules will unlock.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* Month navigation */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-serif text-lg font-semibold text-card-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const dayCapsules = getCapsulesByDay(day)
                const inMonth = isSameMonth(day, currentMonth)
                const today = isToday(day)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const sealedCount = dayCapsules.filter(c => c.status === "sealed").length
                const openedCount = dayCapsules.filter(c => c.status === "opened").length

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`relative flex min-h-[64px] flex-col items-center gap-0.5 rounded-lg p-1.5 text-sm transition-all cursor-pointer bg-transparent border-none shadow-none ${
                      !inMonth ? "opacity-30" : ""
                    } ${today ? "ring-1 ring-accent/50" : ""} ${
                      isSelected ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className={`text-xs font-medium ${today ? "text-accent font-bold" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </span>
                    {dayCapsules.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {sealedCount > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" /> {sealedCount}
                          </span>
                        )}
                        {openedCount > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
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

        {/* Selected day detail */}
        {selectedDate && (
          <div className="border-t border-border p-4">
            <h3 className="mb-3 font-serif text-sm font-semibold text-card-foreground">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h3>
            {selectedCapsules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No capsules unlocking on this day.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedCapsules.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCapsule ? onSelectCapsule(c.id) : navigate(`/capsules/${c.id}`)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/60 cursor-pointer bg-transparent shadow-none"
                  >
                    {c.coverImageUrl && (
                      <img src={c.coverImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.status === "sealed" ? "🔒 Sealed" : "✅ Opened"} • {format(new Date(c.unlockAt), "h:mm a")}
                      </p>
                    </div>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1">
                        {c.tags.slice(0, 2).map(t => (
                          <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{t}</span>
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

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Sealed (locked)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Opened
        </div>
      </div>
    </div>
  )
}

