import { useEffect, useRef, useState } from "react"
import { Clock, Lock } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { VisibilityBadge } from "@/components/visibility-badge"
import { resolveAssetUrl } from "@/lib/asset-url"
import type { Capsule } from "@/services/api"

interface CapsuleCardProps {
  capsule: Capsule
  onClick: (id: string) => void
}

function formatShortDate(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getScheduleLabel(capsule: Capsule) {
  if (capsule.isLocked && capsule.unlockAt) {
    return `Unlocks ${formatShortDate(capsule.unlockAt)}`
  }

  if (capsule.status === "opened") {
    return capsule.openedAt ? `Opened ${formatShortDate(capsule.openedAt)}` : "Opened recently"
  }

  if (capsule.status === "draft") {
    return "Draft with no unlock date"
  }

  if (capsule.unlockAt) {
    return `Unlocks ${formatShortDate(capsule.unlockAt)}`
  }

  return "Unlock date not scheduled"
}

export function CapsuleCard({ capsule, onClick }: CapsuleCardProps) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")
  const [showUnlockAnim, setShowUnlockAnim] = useState(false)
  const prevStatus = useRef(capsule.status)
  const scheduleLabel = getScheduleLabel(capsule)

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  useEffect(() => {
    if (prevStatus.current === "sealed" && capsule.status === "opened") {
      setShowUnlockAnim(true)
      const timeoutId = setTimeout(() => setShowUnlockAnim(false), 1200)
      return () => clearTimeout(timeoutId)
    }
    prevStatus.current = capsule.status
  }, [capsule.status])

  return (
    <button
      onClick={() => onClick(capsule.id)}
      className={`group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/5 ${showUnlockAnim ? "animate-unlock-card" : ""}`}
    >
      {coverSrc && (
        <div className="relative h-36 w-full overflow-hidden">
          <img
            src={resolveAssetUrl(coverSrc)}
            alt={capsule.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setCoverSrc("/static/tags/default.jpg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
        </div>
      )}

      <div className="flex flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={capsule.status} />
          <VisibilityBadge visibility={capsule.visibility} />
        </div>

        <h3 className="mb-1.5 font-serif text-lg font-semibold text-card-foreground transition-colors group-hover:text-accent">
          {capsule.title}
        </h3>

        {capsule.isLocked ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm italic text-muted-foreground">Content sealed until the unlock date</p>
          </div>
        ) : capsule.body ? (
          <p className="mb-4 line-clamp-2 break-words whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {capsule.body}
          </p>
        ) : capsule.status === "draft" ? (
          <p className="mb-4 text-sm italic text-muted-foreground">Visible only to you until you seal it.</p>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className={capsule.isLocked ? "font-medium" : undefined}>
            {capsule.isLocked ? `Locked - ${scheduleLabel}` : scheduleLabel}
          </span>
        </div>

        {capsule.tags && capsule.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {capsule.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
