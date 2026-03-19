import { useEffect, useRef, useState } from "react"
import { Clock, Lock } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { VisibilityBadge } from "@/components/visibility-badge"
import type { Capsule } from "@/services/api"

interface CapsuleCardProps {
  capsule: Capsule
  onClick: (id: string) => void
}

export function CapsuleCard({ capsule, onClick }: CapsuleCardProps) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")
  const [showUnlockAnim, setShowUnlockAnim] = useState(false)
  const prevStatus = useRef(capsule.status)

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  useEffect(() => {
    if (prevStatus.current === 'sealed' && capsule.status === 'opened') {
      setShowUnlockAnim(true)
      const t = setTimeout(() => setShowUnlockAnim(false), 1200)
      return () => clearTimeout(t)
    }
    prevStatus.current = capsule.status
  }, [capsule.status])

  return (
    <button
      onClick={() => onClick(capsule.id)}
      className={`group flex flex-col rounded-2xl border border-border bg-card text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/5 cursor-pointer w-full overflow-hidden ${showUnlockAnim ? 'animate-unlock-card' : ''}`}
    >
      {coverSrc && (
        <div className="relative h-36 w-full overflow-hidden">
          <img
            src={coverSrc}
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
          <p className="text-sm italic text-muted-foreground">Content sealed until unlock date</p>
        </div>
      ) : capsule.body ? (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-wrap">{capsule.body}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {capsule.isLocked ? (
          <span className="font-medium">🔒 Unlocks {new Date(capsule.unlockAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        ) : capsule.status === 'opened' ? (
          <span>Opened {capsule.openedAt ? new Date(capsule.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'recently'}</span>
        ) : (
          <span>Unlocks {new Date(capsule.unlockAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        )}
      </div>
      {capsule.tags && capsule.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {capsule.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{tag}</span>
          ))}
        </div>
      )}
      </div>
    </button>
  )
}

