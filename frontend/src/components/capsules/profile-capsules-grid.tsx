import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Timer, Lock, Eye, Users, Grid3X3, List, Map } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { CapsulesMapView } from "@/components/capsules/capsules-map-view"
import type { Capsule, CapsuleMapMarker } from "@/services/api"

interface ProfileCapsulesGridProps {
  capsules: Capsule[]
  isOwnProfile: boolean
  username: string
}

type CapsuleViewMode = "grid" | "list" | "map"
type ProfileMapFocusState = {
  profileMapIntent?: {
    viewMode?: CapsuleViewMode
    searchQuery?: string
  }
  focusCapsuleId?: string
  focusCoordinates?: [number, number]
}

function resolveVisibleCapsules(capsules: Capsule[], isOwnProfile: boolean) {
  if (isOwnProfile) return capsules
  return capsules.filter((capsule) => capsule.visibility !== "private")
}

export function ProfileCapsulesGrid({
  capsules,
  isOwnProfile,
  username,
}: ProfileCapsulesGridProps) {
  const [viewMode, setViewMode] = useState<CapsuleViewMode>("grid")
  const navigate = useNavigate()
  const location = useLocation()
  const focusState = (location.state as ProfileMapFocusState | null) || null
  const requestedViewMode = focusState?.profileMapIntent?.viewMode || null
  const mapSearchSeed = focusState?.profileMapIntent?.searchQuery || ""
  const focusedCapsuleId = focusState?.focusCapsuleId || null

  const visibleCapsules = resolveVisibleCapsules(capsules, isOwnProfile)
  const mapMarkers = useMemo<CapsuleMapMarker[]>(() => {
    return visibleCapsules
      .filter((capsule) => {
        const lon = capsule.location?.coordinates?.[0]
        const lat = capsule.location?.coordinates?.[1]
        return Number.isFinite(lon) && Number.isFinite(lat)
      })
      .map((capsule) => ({
        id: capsule.id,
        title: capsule.title,
        ownerId: isOwnProfile ? "me" : `user-${username}`,
        ownerName: isOwnProfile ? "You" : `@${username}`,
        visibility: capsule.visibility,
        status: capsule.status,
        isLocked: capsule.isLocked,
        isOwn: isOwnProfile,
        coverImageUrl: capsule.coverImageUrl ?? null,
        unlockAt: capsule.unlockAt ?? null,
        openedAt: capsule.openedAt ?? null,
        tags: capsule.tags ?? null,
        coordinates: [capsule.location!.coordinates[0], capsule.location!.coordinates[1]],
      }))
  }, [visibleCapsules, isOwnProfile, username])

  useEffect(() => {
    if (viewMode !== "map") return
    if (mapMarkers.length > 0) return
    setViewMode("grid")
  }, [viewMode, mapMarkers.length])

  useEffect(() => {
    if (!requestedViewMode) return
    setViewMode(requestedViewMode)
  }, [requestedViewMode])

  if (visibleCapsules.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title={
          isOwnProfile
            ? "No capsules yet"
            : "No visible capsules"
        }
        description={
          isOwnProfile
            ? "Create your first capsule to preserve your story."
            : `@${username} has no capsules available for viewing.`
        }
        actionLabel={isOwnProfile ? "Create Capsule" : undefined}
        onAction={isOwnProfile ? () => navigate("/create") : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold text-slate-100">
            {visibleCapsules.length} capsule{visibleCapsules.length !== 1 && "s"}
          </p>
          <p className="text-xs text-slate-400">
            {focusedCapsuleId
              ? "Selected capsule"
              : isOwnProfile
              ? "Your capsules archive"
              : "Capsules visible to you"}
          </p>
        </div>

        <div className="flex gap-1 rounded-xl border border-white/12 bg-white/[0.04] p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={`h-9 w-9 p-0 ${viewMode === "grid" ? "border border-cyan-300/35 bg-cyan-300/16 text-cyan-100" : "text-slate-300 hover:bg-white/[0.1] hover:text-slate-100"}`}
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={`h-9 w-9 p-0 ${viewMode === "list" ? "border border-cyan-300/35 bg-cyan-300/16 text-cyan-100" : "text-slate-300 hover:bg-white/[0.1] hover:text-slate-100"}`}
            title="List view"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("map")}
            className={`h-9 w-9 p-0 ${viewMode === "map" ? "border border-cyan-300/35 bg-cyan-300/16 text-cyan-100" : "text-slate-300 hover:bg-white/[0.1] hover:text-slate-100"}`}
            title="Map view"
            disabled={mapMarkers.length === 0}
          >
            <Map className="h-4 w-4" />
            <span className="sr-only">Map view</span>
          </Button>
        </div>
      </div>

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCapsules.map((capsule) => (
            <CapsuleGridItem
              key={capsule.id}
              capsule={capsule}
              isFocused={focusedCapsuleId === capsule.id}
              onClick={() => navigate(`/capsules/${capsule.id}`, { state: { from: location.pathname } })}
            />
          ))}
        </div>
      )}

      {viewMode === "list" && (
        <div className="flex flex-col gap-3">
          {visibleCapsules.map((capsule) => (
            <CapsuleListItem
              key={capsule.id}
              capsule={capsule}
              isFocused={focusedCapsuleId === capsule.id}
              onClick={() => navigate(`/capsules/${capsule.id}`, { state: { from: location.pathname } })}
            />
          ))}
        </div>
      )}

      {viewMode === "map" && mapMarkers.length > 0 && (
        <CapsulesMapView
          embedded
          hideHeader
          markersOverride={mapMarkers}
          fromPath={location.pathname}
          initialSearch={mapSearchSeed}
          onOpenCapsule={(marker) => navigate(`/capsules/${marker.id}`, { state: { from: location.pathname } })}
        />
      )}

      {viewMode === "map" && mapMarkers.length === 0 && (
        <EmptyState
          icon={Map}
          title="No mapped capsules"
          description={isOwnProfile ? "Add locations to your capsules to display them on the map." : "This profile has no capsules with locations."}
        />
      )}
    </div>
  )
}

function CapsuleGridItem({ capsule, onClick, isFocused = false }: { capsule: Capsule; onClick: () => void; isFocused?: boolean }) {
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
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left shadow-[0_22px_50px_rgba(2,6,23,0.45)] transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/70 ${
        isFocused
          ? "border-cyan-200/55 bg-slate-900/72 shadow-[0_0_0_1px_rgba(94,230,255,0.45),0_22px_50px_rgba(2,6,23,0.45)]"
          : "border-white/14 bg-slate-950/65 hover:border-cyan-200/35"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(94,230,255,0.08)_0%,rgba(94,230,255,0)_42%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(124,92,255,0.1)_0%,rgba(124,92,255,0)_44%)]" />

      <div className="relative flex items-start justify-between gap-2">
        <StatusBadge status={capsule.status} size="sm" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/60 text-slate-200">
          <VisibilityIcon className="h-4 w-4" />
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-xl border border-white/12 bg-slate-900/55">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={capsule.title}
            className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setCoverSrc("/static/tags/default.jpg")}
          />
        ) : (
          <div className="flex h-36 items-center justify-center">
            <Timer className="h-9 w-9 text-slate-500" />
          </div>
        )}
      </div>

      <div className="relative mt-3 space-y-2">
        {isFocused && (
          <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/14 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
            Selected
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-slate-100">{capsule.title}</h3>
        {capsule.body && !capsule.isLocked && (
          <p className="line-clamp-2 text-xs leading-5 text-slate-300">{capsule.body}</p>
        )}

        {capsule.tags && capsule.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {capsule.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-cyan-300/25 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                {tag}
              </span>
            ))}
            {capsule.tags.length > 3 && (
              <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                +{capsule.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Unlocks{" "}
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

function CapsuleListItem({ capsule, onClick, isFocused = false }: { capsule: Capsule; onClick: () => void; isFocused?: boolean }) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  return (
    <button
      onClick={onClick}
      className={`group flex items-start gap-4 rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-900/65 ${
        isFocused
          ? "border-cyan-200/55 bg-slate-900/72 shadow-[0_0_0_1px_rgba(94,230,255,0.42)]"
          : "border-white/14 bg-slate-950/60 hover:border-cyan-300/35"
      }`}
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-slate-900/55">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={capsule.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={() => setCoverSrc("/static/tags/default.jpg")}
          />
        ) : (
          <Timer className="h-7 w-7 text-slate-500 transition-transform duration-300 group-hover:scale-110" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-100">{capsule.title}</h3>
          <StatusBadge status={capsule.status} size="sm" />
        </div>
        {isFocused && (
          <span className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/14 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
            Selected
          </span>
        )}

        {capsule.body && !capsule.isLocked && (
          <p className="line-clamp-1 text-xs text-slate-300">{capsule.body}</p>
        )}

        {capsule.tags && capsule.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {capsule.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-cyan-300/25 bg-cyan-400/12 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                {tag}
              </span>
            ))}
            {capsule.tags.length > 3 && (
              <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                +{capsule.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Unlocks{" "}
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
