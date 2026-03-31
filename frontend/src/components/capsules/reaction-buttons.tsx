import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark, Heart, Loader2, Sparkles, ThumbsUp, type LucideIcon } from "lucide-react"
import { getReactionSummary, toggleReaction, type ReactionSummary } from "@/services/api"

interface ReactionButtonsProps {
  capsuleId: string
  isAuthenticated: boolean
}

type ReactionType = "like" | "love" | "wow" | "bookmark"

const REACTION_CONFIG: Record<
  ReactionType,
  {
    label: string
    Icon: LucideIcon
    tone: string
    activeTone: string
    textTone: string
    glow: string
  }
> = {
  like: {
    label: "Like",
    Icon: ThumbsUp,
    tone: "border-cyan-300/45 bg-cyan-400/20 hover:bg-cyan-400/30",
    activeTone: "border-cyan-200/80 bg-cyan-300/38",
    textTone: "text-cyan-50",
    glow: "shadow-[0_0_28px_rgba(94,230,255,0.34)]",
  },
  love: {
    label: "Love",
    Icon: Heart,
    tone: "border-violet-300/45 bg-violet-400/20 hover:bg-violet-400/30",
    activeTone: "border-violet-200/80 bg-violet-400/38",
    textTone: "text-violet-50",
    glow: "shadow-[0_0_28px_rgba(124,92,255,0.34)]",
  },
  wow: {
    label: "Wow",
    Icon: Sparkles,
    tone: "border-amber-300/45 bg-amber-300/20 hover:bg-amber-300/30",
    activeTone: "border-amber-200/80 bg-amber-300/40",
    textTone: "text-amber-50",
    glow: "shadow-[0_0_28px_rgba(251,191,36,0.32)]",
  },
  bookmark: {
    label: "Bookmark",
    Icon: Bookmark,
    tone: "border-emerald-300/45 bg-emerald-400/20 hover:bg-emerald-400/30",
    activeTone: "border-emerald-200/80 bg-emerald-400/38",
    textTone: "text-emerald-50",
    glow: "shadow-[0_0_28px_rgba(16,185,129,0.3)]",
  },
}

const REACTION_TYPES: ReactionType[] = ["like", "love", "wow", "bookmark"]

export function ReactionButtons({ capsuleId, isAuthenticated }: ReactionButtonsProps) {
  const [summary, setSummary] = useState<ReactionSummary>({ counts: {}, userReactions: [] })
  const [loadingType, setLoadingType] = useState<ReactionType | null>(null)
  const [animatingType, setAnimatingType] = useState<ReactionType | null>(null)

  useEffect(() => {
    getReactionSummary(capsuleId).then(setSummary).catch(() => {})
  }, [capsuleId])

  const handleToggle = async (type: ReactionType) => {
    if (!isAuthenticated || loadingType) return
    setLoadingType(type)
    setAnimatingType(type)
    try {
      const updated = await toggleReaction(capsuleId, type)
      setSummary(updated)
    } catch {
      // ignore
    } finally {
      setLoadingType(null)
      setTimeout(() => setAnimatingType(null), 260)
    }
  }

  const totalReactions = Object.values(summary.counts || {}).reduce((acc, value) => acc + value, 0)
  const userReactions = new Set(summary.userReactions || [])

  return (
    <section className="rounded-2xl border border-white/12 bg-slate-900/48 p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-slate-100">Reactions</h3>
          <p className="text-xs text-slate-400">Pick one reaction for this capsule.</p>
        </div>
        <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-200">
          {totalReactions} reaction{totalReactions === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {REACTION_TYPES.map((type) => {
          const config = REACTION_CONFIG[type]
          const count = summary.counts?.[type] || 0
          const active = userReactions.has(type)
          const loading = loadingType === type
          const isAnimating = animatingType === type
          const Icon = config.Icon

          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              onClick={() => handleToggle(type)}
              disabled={!!loadingType || !isAuthenticated}
              className={`relative h-auto min-h-[80px] flex-col gap-1.5 rounded-xl border px-3 py-3 transition-all duration-200 ${
                active ? `${config.activeTone} ${config.glow}` : config.tone
              } ${isAnimating ? "scale-[1.04]" : "scale-100"} ${
                !isAuthenticated ? "cursor-default opacity-70" : "hover:-translate-y-0.5"
              }`}
              title={isAuthenticated ? `${config.label} this capsule` : "Sign in to react"}
            >
              <span className={config.textTone}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className={`text-xs font-semibold ${config.textTone}`}>{config.label}</span>
              <span className={`text-xs font-semibold ${active ? config.textTone : "text-slate-100/90"}`}>{count}</span>
            </Button>
          )
        })}
      </div>

      {!isAuthenticated && (
        <p className="mt-3 text-xs text-slate-400">Sign in to leave a reaction.</p>
      )}
    </section>
  )
}
