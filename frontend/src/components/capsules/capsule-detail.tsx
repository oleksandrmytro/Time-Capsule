import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { MediaGallery } from "@/components/media/media-gallery"
import { ShareCapsuleDialog } from "@/components/capsules/share-capsule-dialog"
import { ReactionButtons } from "@/components/capsules/reaction-buttons"
import { CommentsSection } from "@/components/capsules/comments-section"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  CheckCircle2,
  MessageSquare,
  Heart,
  Lock,
  Unlock,
  Share2,
  MapPin,
  FileText,
  Download,
  Globe,
  Link2,
} from "lucide-react"
import { getApiBase, getUserProfile, type Capsule, type ApiError, type MediaItem, type UserProfile } from "@/services/api"
import type { UserData } from "@/components/users/user-card"

interface CapsuleDetailProps {
  capsule: Capsule
  following: UserData[]
  onBack: () => void
  onUnlock: (id: string) => Promise<void>
  error: ApiError | null
  onRefreshFollowing?: () => void
  isAuthenticated?: boolean
  currentUserId?: string
}

type AttachmentLike = {
  id?: string | number
  url?: string
  thumbnail?: string
  alt?: string
  type?: string
  mimeType?: string
  filename?: string
  name?: string
  title?: string
}

type FileAttachment = {
  id: string
  name: string
  url: string
}

function resolveAssetUrl(url?: string | null) {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${getApiBase()}${url}`
  return `${getApiBase()}/${url}`
}

function inferMediaKind(item: AttachmentLike): "image" | "video" | "file" {
  const rawType = (item.type || "").toLowerCase()
  const rawMime = (item.mimeType || "").toLowerCase()
  const extension = (item.url || "").split("?")[0].split(".").pop()?.toLowerCase() || ""

  if (
    rawType.includes("video") ||
    rawMime.startsWith("video/") ||
    ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(extension)
  ) {
    return "video"
  }

  if (
    rawType.includes("image") ||
    rawMime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "heic"].includes(extension)
  ) {
    return "image"
  }

  return "file"
}

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  opened: {
    label: "Opened",
    className: "border-emerald-300/55 bg-emerald-400/30 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.32)]",
  },
  sealed: {
    label: "Sealed",
    className: "border-cyan-300/55 bg-cyan-400/28 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.28)]",
  },
  draft: {
    label: "Draft",
    className: "border-slate-300/35 bg-slate-400/22 text-slate-100",
  },
}

const VISIBILITY_PILL: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  public: {
    label: "Public",
    icon: Globe,
    className: "border-cyan-300/50 bg-cyan-400/26 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.2)]",
  },
  shared: {
    label: "Shared",
    icon: Link2,
    className: "border-violet-300/52 bg-violet-400/28 text-violet-50 shadow-[0_0_16px_rgba(167,139,250,0.22)]",
  },
  private: {
    label: "Private",
    icon: Lock,
    className: "border-slate-300/35 bg-slate-400/22 text-slate-100",
  },
}

export function CapsuleDetail({
  capsule,
  following,
  onBack,
  onUnlock,
  error,
  onRefreshFollowing,
  isAuthenticated = false,
  currentUserId,
}: CapsuleDetailProps) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")
  const [copied, setCopied] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState("")
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null)
  const hasShownUnlockAnimation = useRef(!capsule.isLocked)
  const prevLocked = useRef(capsule.isLocked)
  const navigate = useNavigate()
  const canShare = isAuthenticated && (capsule.visibility === "public" || !!capsule.shareToken)
  const hasLocation =
    Array.isArray(capsule.location?.coordinates) &&
    capsule.location.coordinates.length === 2 &&
    Number.isFinite(capsule.location.coordinates[0]) &&
    Number.isFinite(capsule.location.coordinates[1])
  const statusPill = STATUS_PILL[capsule.status] || STATUS_PILL.draft
  const visibilityPill = VISIBILITY_PILL[capsule.visibility] || VISIBILITY_PILL.private
  const VisibilityIcon = visibilityPill.icon
  const ownerDisplayName = ownerProfile?.displayName || ownerProfile?.username || (capsule.ownerId ? `User ${capsule.ownerId.slice(0, 6)}` : "Unknown user")
  const ownerAvatarUrl = ownerProfile?.avatarUrl || null

  const rawAttachments = useMemo(() => {
    const candidate = (capsule as Capsule & { attachments?: unknown }).attachments
    if (!Array.isArray(candidate)) return [] as AttachmentLike[]
    return candidate.filter((item): item is AttachmentLike => !!item && typeof item === "object")
  }, [capsule])

  const normalizedMedia = useMemo<MediaItem[]>(() => {
    const byUrl = new Map<string, MediaItem>()
    for (const item of capsule.media || []) {
      if (!item?.url) continue
      byUrl.set(item.url, item)
    }

    rawAttachments.forEach((item, index) => {
      if (!item.url) return
      const kind = inferMediaKind(item)
      if (kind === "file") return
      byUrl.set(item.url, {
        id: String(item.id ?? `attachment-${index}`),
        url: item.url,
        thumbnail: item.thumbnail,
        alt: item.alt,
        type: kind,
      })
    })

    return Array.from(byUrl.values())
  }, [capsule.media, rawAttachments])

  const fileAttachments = useMemo<FileAttachment[]>(() => {
    return rawAttachments
      .map((item, index) => {
        if (!item.url || inferMediaKind(item) !== "file") return null
        return {
          id: String(item.id ?? `file-${index}`),
          name: item.filename || item.name || item.title || `Attachment ${index + 1}`,
          url: item.url,
        }
      })
      .filter((item): item is FileAttachment => item !== null)
  }, [rawAttachments])

  useEffect(() => {
    hasShownUnlockAnimation.current = !capsule.isLocked
    prevLocked.current = capsule.isLocked
    setShowUnlockAnimation(false)
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.id, capsule.isLocked, capsule.coverImageUrl])

  useEffect(() => {
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.coverImageUrl])

  useEffect(() => {
    if (!capsule.isLocked || !capsule.unlockAt || !onUnlock) return
    let timer: ReturnType<typeof setInterval>
    const check = async () => {
      const now = Date.now()
      const unlockTime = new Date(capsule.unlockAt).getTime()
      if (now >= unlockTime && !unlocking) {
        setUnlocking(true)
        try {
          await onUnlock(capsule.id)
        } finally {
          setUnlocking(false)
        }
      }
    }
    check()
    timer = setInterval(check, 1000)
    return () => timer && clearInterval(timer)
  }, [capsule.id, capsule.isLocked, capsule.unlockAt, onUnlock, unlocking])

  useEffect(() => {
    if (!capsule.isLocked || !capsule.unlockAt) {
      setTimeLeft("")
      return
    }
    const updateCountdown = () => {
      const now = Date.now()
      const unlockTime = new Date(capsule.unlockAt).getTime()
      const distance = unlockTime - now
      if (distance <= 0) {
        setTimeLeft("Ready to unlock!")
        return
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)
      if (days > 0) setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      else if (minutes > 0) setTimeLeft(`${minutes}m ${seconds}s`)
      else setTimeLeft(`${seconds}s`)
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [capsule.isLocked, capsule.unlockAt])

  useEffect(() => {
    if (prevLocked.current && !capsule.isLocked && !hasShownUnlockAnimation.current) {
      hasShownUnlockAnimation.current = true
      setShowUnlockAnimation(true)
      const timer = setTimeout(() => setShowUnlockAnimation(false), 1800)
      return () => clearTimeout(timer)
    }
    prevLocked.current = capsule.isLocked
  }, [capsule.isLocked])

  useEffect(() => {
    if (!capsule.ownerId) {
      setOwnerProfile(null)
      return
    }
    let cancelled = false
    getUserProfile(capsule.ownerId)
      .then((owner) => {
        if (!cancelled) setOwnerProfile(owner)
      })
      .catch(() => {
        if (!cancelled) setOwnerProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [capsule.ownerId])

  async function openOnMap() {
    const focusCoordinates = hasLocation ? (capsule.location!.coordinates as [number, number]) : undefined
    const profileMapState = focusCoordinates
      ? {
          profileMapIntent: { viewMode: "map", searchQuery: capsule.title },
          focusCapsuleId: capsule.id,
          focusCoordinates,
        }
      : {
          profileMapIntent: { viewMode: "map", searchQuery: capsule.title },
          focusCapsuleId: capsule.id,
        }

    const capsuleOwnerId = capsule.ownerId || null
    const isOwnCapsule = !!capsuleOwnerId && !!currentUserId && capsuleOwnerId === currentUserId

    if (capsuleOwnerId && !isOwnCapsule) {
      try {
        const owner = await getUserProfile(capsuleOwnerId)
        const ownerRouteKey = owner?.username || capsuleOwnerId
        navigate(`/profile/${encodeURIComponent(ownerRouteKey)}`, { state: profileMapState })
      } catch {
        navigate(`/profile/${encodeURIComponent(capsuleOwnerId)}`, { state: profileMapState })
      }
      return
    }

    navigate("/account", { state: profileMapState })
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Not set"
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatMetaDate = (dateString?: string | null) => {
    if (!dateString) return "Not set"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#050816] px-4 py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.16] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,16,0.72)_0%,rgba(3,8,20,0.84)_58%,rgba(3,8,22,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(94,230,255,0.08)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(124,92,255,0.12)_0%,rgba(124,92,255,0)_44%)]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-400/22 text-cyan-50 shadow-[0_8px_20px_rgba(34,211,238,0.16)] hover:bg-cyan-400/32 hover:shadow-[0_10px_24px_rgba(34,211,238,0.22)]"
              onClick={openOnMap}
              disabled={!hasLocation}
              title={hasLocation ? "Show this capsule on your profile map" : "No location attached to this capsule"}
            >
              <MapPin className="h-3.5 w-3.5" /> Show on map
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-lg border border-violet-300/45 bg-violet-400/28 text-violet-50 shadow-[0_8px_20px_rgba(124,92,255,0.2)] hover:bg-violet-400/38 hover:shadow-[0_10px_24px_rgba(124,92,255,0.26)]"
              onClick={() => canShare && setShareOpen(true)}
              disabled={!canShare}
              title={canShare ? "Share this capsule" : "Sign in to share this capsule"}
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-lg border border-sky-300/40 bg-sky-400/22 text-sky-50 shadow-[0_8px_20px_rgba(56,189,248,0.16)] hover:bg-sky-400/32 hover:shadow-[0_10px_24px_rgba(56,189,248,0.22)]"
              onClick={() => {
                const url = `${window.location.origin}/capsules/${capsule.id}`
                navigator.clipboard.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Link copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </>
              )}
            </Button>
          </div>
        </div>

        <article className="overflow-hidden rounded-3xl border border-white/12 bg-slate-900/50 shadow-[0_34px_90px_rgba(2,6,23,0.62)] backdrop-blur-xl">
          <div className="relative">
            {coverSrc ? (
              <div className="relative h-[260px] overflow-hidden border-b border-white/10 sm:h-[360px]">
                <img
                  src={resolveAssetUrl(coverSrc)}
                  alt={capsule.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setCoverSrc("/static/tags/default.jpg")}
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,6,16,0.22),rgba(3,6,16,0.82))]" />
              </div>
            ) : (
              <div className="h-[230px] border-b border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(94,230,255,0.12)_0%,rgba(94,230,255,0)_42%),radial-gradient(circle_at_80%_24%,rgba(124,92,255,0.18)_0%,rgba(124,92,255,0)_48%),linear-gradient(180deg,rgba(3,6,16,0.7),rgba(3,6,16,0.88))] sm:h-[280px]" />
            )}

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md ${statusPill.className}`}
                >
                  {statusPill.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md ${visibilityPill.className}`}
                >
                  <VisibilityIcon className="h-3 w-3" />
                  {visibilityPill.label}
                </span>
                {capsule.allowComments && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/55 bg-cyan-400/28 px-2.5 py-0.5 text-xs font-semibold text-cyan-50 backdrop-blur-md shadow-[0_0_14px_rgba(34,211,238,0.2)]">
                    <MessageSquare className="h-3 w-3" /> Comments
                  </span>
                )}
                {capsule.allowReactions && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/55 bg-violet-400/30 px-2.5 py-0.5 text-xs font-semibold text-violet-50 backdrop-blur-md shadow-[0_0_14px_rgba(167,139,250,0.22)]">
                    <Heart className="h-3 w-3" /> Reactions
                  </span>
                )}
              </div>
              <h1 className="max-w-3xl font-serif text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">{capsule.title}</h1>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/45 px-2.5 py-1 backdrop-blur-md">
                {ownerAvatarUrl ? (
                  <img
                    src={resolveAssetUrl(ownerAvatarUrl)}
                    alt={ownerDisplayName}
                    className="h-6 w-6 rounded-full border border-white/20 object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-[10px] font-semibold text-cyan-100">
                    {ownerDisplayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-100">
                  By {ownerDisplayName}
                </span>
              </div>
              {capsule.tags && capsule.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {capsule.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showUnlockAnimation ? (
            <div className="p-5 sm:p-7">
              <div className="animate-unlock-card flex flex-col items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-300/10 py-14 text-center shadow-[0_0_42px_rgba(52,211,153,0.16)]">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-300/14">
                  <Unlock className="h-10 w-10 text-emerald-200" />
                </div>
                <h3 className="text-2xl font-semibold text-emerald-100">Capsule unlocked</h3>
                <p className="mt-2 text-sm text-emerald-200/85">The memory is open now.</p>
              </div>
            </div>
          ) : capsule.isLocked ? (
            <div className="p-5 sm:p-7">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/14 bg-slate-950/48 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-violet-300/25 bg-violet-400/12">
                  <Lock className="h-8 w-8 text-violet-100" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100">This capsule is sealed</h3>
                <p className="mt-1 text-sm text-slate-300">The content will be revealed on:</p>
                <p className="mt-1 text-base font-semibold text-cyan-200">{formatDate(capsule.unlockAt)}</p>
                {timeLeft && (
                  <div className="mt-4 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-4 py-2">
                    <p className="font-mono text-sm font-semibold text-cyan-100">{timeLeft}</p>
                  </div>
                )}
                <p className="mt-4 text-xs text-slate-400">It will open automatically when the timer reaches zero.</p>
                {error && (
                  <div className="mt-4 rounded-lg border border-rose-300/35 bg-rose-500/12 px-4 py-2 text-sm text-rose-200">
                    {error.status === 403 ? "You do not have access to this capsule." : error.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 px-5 pb-6 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
              <div className="rounded-xl border border-cyan-300/18 bg-[linear-gradient(165deg,rgba(10,20,46,0.74)_0%,rgba(7,14,33,0.8)_100%)] px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-1.5 text-cyan-100">
                  <FileText className="h-4 w-4" />
                  <p className="text-sm font-semibold">Message</p>
                </div>
                {capsule.body ? (
                  <div className="mt-2.5 animate-in fade-in slide-in-from-bottom-3 duration-700">
                    <div className="rounded-lg border border-cyan-300/14 bg-[#08122a]/68 px-4 py-3 sm:px-5 sm:py-4">
                      <p className="max-w-3xl break-words whitespace-pre-wrap text-[15px] leading-7 text-slate-100/95 sm:text-base">
                        {capsule.body}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm italic text-slate-400">No message in this capsule.</p>
                )}
              </div>

              {(normalizedMedia.length > 0 || fileAttachments.length > 0) && (
                <div className="rounded-2xl border border-white/12 bg-slate-900/48 p-5 sm:p-6">
                  <p className="text-sm font-semibold text-violet-100">Attachments</p>
                  {normalizedMedia.length > 0 && (
                    <MediaGallery media={normalizedMedia} appearance="dark" className="mt-3" />
                  )}
                  {fileAttachments.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {fileAttachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={resolveAssetUrl(attachment.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.07]"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-cyan-200" />
                            <span className="truncate">{attachment.name}</span>
                          </span>
                          <Download className="h-4 w-4 text-slate-300" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {capsule.visibility === "public" && (
                <div className="space-y-4">
                  {capsule.allowReactions !== false && (
                    <ReactionButtons capsuleId={capsule.id} isAuthenticated={isAuthenticated} />
                  )}
                  {capsule.allowComments !== false && (
                    <CommentsSection
                      capsuleId={capsule.id}
                      isAuthenticated={isAuthenticated}
                      currentUserId={currentUserId}
                      capsuleOwnerId={capsule.ownerId}
                      capsuleOwnerName={ownerDisplayName}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2.5 border-t border-white/10 bg-[#050b1a]/55 px-4 py-3 sm:grid-cols-2 sm:px-6 sm:py-4 lg:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">
                <Clock className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Unlock</p>
                <p className="truncate text-sm font-medium text-slate-100">{formatMetaDate(capsule.unlockAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">
                <Calendar className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Expires</p>
                <p className="truncate text-sm font-medium text-slate-100">{formatMetaDate(capsule.expiresAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">
                <MapPin className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Location</p>
                {hasLocation ? (
                  <p className="truncate text-sm font-medium text-cyan-200">Location attached</p>
                ) : (
                  <p className="truncate text-sm text-slate-400">No location attached</p>
                )}
              </div>
            </div>
          </div>
        </article>

        <ShareCapsuleDialog
          capsuleId={capsule.id}
          capsuleTitle={capsule.title}
          following={following}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      </div>
    </section>
  )
}
