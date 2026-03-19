import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Timer, Lock, Eye, Users, Grid3X3, List } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import type { Capsule } from "@/services/api"

interface ProfileCapsulesGridProps {
  capsules: Capsule[]
  isOwnProfile: boolean
  username: string
}

export function ProfileCapsulesGrid({
  capsules,
  isOwnProfile,
  username,
}: ProfileCapsulesGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const navigate = useNavigate()
  const location = useLocation()

  // Filter capsules: own profile shows all, other profiles show only public
  const visibleCapsules = isOwnProfile
    ? capsules
    : capsules.filter((c) => c.visibility === "public")

  if (visibleCapsules.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title={
          isOwnProfile
            ? "No capsules yet"
            : "No public capsules"
        }
        description={
          isOwnProfile
            ? "Start creating time capsules to preserve your memories for the future."
            : `Sorry, @${username} hasn't created any public capsules yet.`
        }
        actionLabel={isOwnProfile ? "Create Capsule" : undefined}
        onAction={isOwnProfile ? () => navigate("/create") : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* View mode toggle and count */}
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold text-card-foreground">
            {visibleCapsules.length} capsule{visibleCapsules.length !== 1 && "s"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOwnProfile ? "Your time capsules" : "Public capsules"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-9 w-9 p-0 transition-all"
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-9 w-9 p-0 transition-all"
            title="List view"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {visibleCapsules.map((capsule) => (
            <CapsuleGridItem key={capsule.id} capsule={capsule} onClick={() => navigate(`/capsules/${capsule.id}`, { state: { from: location.pathname } })} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleCapsules.map((capsule) => (
            <CapsuleListItem key={capsule.id} capsule={capsule} onClick={() => navigate(`/capsules/${capsule.id}`, { state: { from: location.pathname } })} />
          ))}
        </div>
      )}
    </div>
  )
}

function CapsuleGridItem({ capsule, onClick }: { capsule: Capsule; onClick: () => void }) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  const VisibilityIcon =
    capsule.visibility === "private"
      ? Lock
      : capsule.visibility === "shared"
        ? Users
        : Eye

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/15 hover:border-accent/50 cursor-pointer w-full text-left"
    >
      {/* Cover image OR background pattern */}
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={capsule.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setCoverSrc("/static/tags/default.jpg")}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 transition-opacity duration-300 group-hover:opacity-20">
          <Timer className="h-20 w-20 text-primary" />
        </div>
      )}

      {/* Gradient overlay — stronger when cover exists */}
      <div className={`absolute inset-0 bg-gradient-to-t ${coverSrc ? "from-black/60 via-black/10 to-transparent" : "from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100"} transition-opacity duration-300`} />

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5">
        {/* Top: badges */}
        <div className="flex items-start justify-between">
          <StatusBadge status={capsule.status} size="sm" />
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all group-hover:bg-background/90">
            <VisibilityIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Bottom: title */}
        <div className="rounded-lg bg-background/60 p-3 backdrop-blur-md transition-all duration-300 group-hover:bg-background/90">
          <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-card-foreground sm:text-sm sm:leading-snug">
            {capsule.title}
          </h3>
          {capsule.tags && capsule.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {capsule.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground backdrop-blur-sm">
                  {tag}
                </span>
              ))}
              {capsule.tags.length > 2 && (
                <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground backdrop-blur-sm">
                  +{capsule.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function CapsuleListItem({ capsule, onClick }: { capsule: Capsule; onClick: () => void }) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 cursor-pointer w-full text-left"
    >
      {/* Thumbnail: cover image OR icon */}
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 transition-all duration-300 group-hover:from-primary/25 group-hover:to-accent/30">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={capsule.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={() => setCoverSrc("/static/tags/default.jpg")}
          />
        ) : (
          <Timer className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Status and title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-semibold text-card-foreground transition-colors duration-300 group-hover:text-accent">
              {capsule.title}
            </h3>
          </div>
          <StatusBadge status={capsule.status} size="sm" />
        </div>

        {/* Message preview */}
        {capsule.body && !capsule.isLocked && (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {capsule.body}
          </p>
        )}

        {/* Tags */}
        {capsule.tags && capsule.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {capsule.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {tag}
              </span>
            ))}
            {capsule.tags.length > 3 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                +{capsule.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Unlock date */}
        <p className="text-xs text-muted-foreground font-medium">
          {capsule.isLocked ? "🔒 " : ""}Unlocks{" "}
          {new Date(capsule.unlockAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </button>
  )
}
