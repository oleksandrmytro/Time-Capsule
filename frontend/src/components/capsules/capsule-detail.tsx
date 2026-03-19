import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { StatusBadge } from "@/components/status-badge"
import { VisibilityBadge } from "@/components/visibility-badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MediaGallery } from "@/components/media/media-gallery"
import { ShareCapsuleDialog } from "@/components/capsules/share-capsule-dialog"
import { ReactionButtons } from "@/components/capsules/reaction-buttons"
import { CommentsSection } from "@/components/capsules/comments-section"
import { ArrowLeft, Calendar, Clock, Copy, CheckCircle2, MessageSquare, Heart, Lock, Unlock, Share2 } from "lucide-react"
import type { Capsule, ApiError } from "@/services/api"
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

export function CapsuleDetail({ capsule, following, onBack, onUnlock, error, onRefreshFollowing, isAuthenticated = false, currentUserId }: CapsuleDetailProps) {
  const [coverSrc, setCoverSrc] = useState(capsule.coverImageUrl ?? "")
  const [copied, setCopied] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState("")
  const hasShownUnlockAnimation = useRef(!capsule.isLocked)
  const prevLocked = useRef(capsule.isLocked)
  const navigate = useNavigate()
  const canShare = isAuthenticated && (capsule.visibility === "public" || !!capsule.shareToken)

  useEffect(() => {
    hasShownUnlockAnimation.current = !capsule.isLocked
    prevLocked.current = capsule.isLocked
    setShowUnlockAnimation(false)
    setCoverSrc(capsule.coverImageUrl ?? "")
  }, [capsule.id])

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
  }, [capsule.isLocked, capsule.unlockAt, capsule.id, onUnlock, unlocking])

  useEffect(() => {
    if (!capsule.isLocked || !capsule.unlockAt) { setTimeLeft(""); return }
    const updateCountdown = () => {
      const now = Date.now()
      const unlockTime = new Date(capsule.unlockAt).getTime()
      const distance = unlockTime - now
      if (distance <= 0) { setTimeLeft("Ready to unlock!"); return }
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
      const t = setTimeout(() => setShowUnlockAnimation(false), 1800)
      return () => clearTimeout(t)
    }
    prevLocked.current = capsule.isLocked
  }, [capsule.isLocked])

  function copyShareLink() {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${capsule.shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="self-start gap-1.5 text-muted-foreground -ml-3"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => canShare && setShareOpen(true)} disabled={!canShare} title={canShare ? "Share this capsule" : "Увійдіть, щоб поділитися"}>
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const url = `${window.location.origin}/capsules/${capsule.id}`; navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
              {copied ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" />Link Copied</> : <><Copy className="h-3.5 w-3.5" />Copy Link</>}
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {coverSrc && (
            <div className="h-64 w-full overflow-hidden rounded-t-2xl border-b border-border sm:h-80">
              <img
                src={coverSrc}
                alt={capsule.title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setCoverSrc("/static/tags/default.jpg")}
              />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={capsule.status} />
              <VisibilityBadge visibility={capsule.visibility} />
              {capsule.allowComments && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"><MessageSquare className="h-3 w-3" />Comments</span>}
              {capsule.allowReactions && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"><Heart className="h-3 w-3" />Reactions</span>}
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-card-foreground sm:text-3xl">{capsule.title}</h1>
            {capsule.tags && capsule.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {capsule.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{tag}</span>)}
              </div>
            )}
          </div>
          <Separator />
          {showUnlockAnimation ? (
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-solid border-success/50 bg-success/5 py-16 text-center animate-unlock-card">
                <div className="mb-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/20 ring-4 ring-success/10">
                    <Unlock className="h-10 w-10 text-success" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-bold text-success">Unlocked!</h3>
                <p className="text-sm text-muted-foreground">Your capsule is now open.</p>
              </div>
            </div>
          ) : capsule.isLocked ? (
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">This capsule is sealed</h3>
                <p className="mb-1 text-sm text-muted-foreground">The content will be revealed on:</p>
                <p className="text-base font-semibold text-accent">{formatDate(capsule.unlockAt)}</p>
                {timeLeft && (
                  <div className="mt-4 rounded-lg bg-primary/10 px-4 py-2">
                    <p className="text-sm font-mono font-semibold text-primary">{timeLeft}</p>
                  </div>
                )}
                <p className="mt-4 text-xs text-muted-foreground">Will open automatically once time comes.</p>
                {error && (
                  <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {error.status === 403 ? 'Вибачте, у вас немає доступу до цієї капсули.' : error.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {capsule.body ? (
                <div className="p-6 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-700 break-words whitespace-pre-wrap">
                  {capsule.body.split("\n").map((paragraph, i) => <p key={i} className="mb-3 leading-relaxed text-card-foreground last:mb-0">{paragraph || <br />}</p>)}
                </div>
              ) : (
                <div className="p-6 sm:p-8">
                  <p className="text-sm italic text-muted-foreground">No message content</p>
                </div>
              )}
              {capsule.media && capsule.media.length > 0 && (
                <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                  <MediaGallery media={capsule.media} />
                </div>
              )}
              <Separator />
              {/* Реакції та коментарі — тільки для публічних відкритих капсул */}
              {capsule.visibility === "public" && (
                <div className="flex flex-col gap-6 p-6 sm:p-8">
                  {capsule.allowReactions !== false && (
                    <ReactionButtons capsuleId={capsule.id} isAuthenticated={isAuthenticated} />
                  )}
                  {capsule.allowComments !== false && (
                    <>
                      <Separator />
                      <CommentsSection capsuleId={capsule.id} isAuthenticated={isAuthenticated} currentUserId={currentUserId} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10"><Clock className="h-4 w-4 text-accent" /></div>
              <div><p className="text-xs font-medium text-muted-foreground">Unlock Date</p><p className="text-sm font-semibold text-card-foreground">{formatDate(capsule.unlockAt)}</p></div>
            </div>
            {capsule.expiresAt && (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10"><Calendar className="h-4 w-4 text-warning" /></div>
                <div><p className="text-xs font-medium text-muted-foreground">Expires Date</p><p className="text-sm font-semibold text-card-foreground">{formatDate(capsule.expiresAt)}</p></div>
              </div>
            )}
          </div>
        </div>
        <ShareCapsuleDialog capsuleId={capsule.id} capsuleTitle={capsule.title} following={following} open={shareOpen} onOpenChange={setShareOpen} />
      </div>
    </div>
  )
}
