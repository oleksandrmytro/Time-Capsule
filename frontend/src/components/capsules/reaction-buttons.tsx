import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Sparkles, Bookmark, Loader2 } from "lucide-react"
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
    getIcon: () => React.ReactNode
    bgColor: string
    activeBgColor: string
    textColor: string
    activeTextColor: string
  }
> = {
  like: {
    label: "Like",
    getIcon: () => <Heart className="h-4 w-4 sm:h-5 sm:w-5" />,
    bgColor: "hover:bg-red-50 dark:hover:bg-red-950/20",
    activeBgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-600 dark:text-red-400",
    activeTextColor: "text-red-600 dark:text-red-400",
  },
  love: {
    label: "Love",
    getIcon: () => <Heart className="h-4 w-4 sm:h-5 sm:w-5" />,
    bgColor: "hover:bg-pink-50 dark:hover:bg-pink-950/20",
    activeBgColor: "bg-pink-50 dark:bg-pink-950/30",
    textColor: "text-pink-600 dark:text-pink-400",
    activeTextColor: "text-pink-600 dark:text-pink-400",
  },
  wow: {
    label: "Wow",
    getIcon: () => <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />,
    bgColor: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    activeBgColor: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-600 dark:text-amber-400",
    activeTextColor: "text-amber-600 dark:text-amber-400",
  },
  bookmark: {
    label: "Bookmark",
    getIcon: () => <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />,
    bgColor: "hover:bg-blue-50 dark:hover:bg-blue-950/20",
    activeBgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-600 dark:text-blue-400",
    activeTextColor: "text-blue-600 dark:text-blue-400",
  },
}

const REACTION_TYPES: ReactionType[] = ["like", "love", "wow", "bookmark"]

export function ReactionButtons({ capsuleId, isAuthenticated }: ReactionButtonsProps) {
  const [summary, setSummary] = useState<ReactionSummary>({ counts: {}, userReactions: [] })
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [animatingType, setAnimatingType] = useState<string | null>(null)

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
    } catch {}
    setLoadingType(null)
    setTimeout(() => setAnimatingType(null), 300)
  }

  const totalReactions = Object.values(summary.counts || {}).reduce((a, b) => a + b, 0)
  const userReaction = summary.userReactions?.[0] || null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">React to this capsule</h3>
        {totalReactions > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 text-xs font-medium text-accent">
            <span className="text-sm">{totalReactions}</span>
            <span className="text-xs">reaction{totalReactions !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {REACTION_TYPES.map((type) => {
          const config = REACTION_CONFIG[type]
          const count = summary.counts?.[type] || 0
          const active = userReaction === type
          const loading = loadingType === type
          const isAnimating = animatingType === type

          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              onClick={() => handleToggle(type)}
              disabled={!!loadingType || !isAuthenticated}
              className={`
                relative h-auto flex-col gap-1.5 px-3 py-2.5 sm:py-3 transition-all duration-200
                ${active ? config.activeBgColor : config.bgColor}
                ${active ? "border border-current" : ""}
                hover:scale-105
                ${isAnimating ? "scale-110" : "scale-100"}
                ${!isAuthenticated ? "cursor-default opacity-70" : ""}
              `}
              title={isAuthenticated ? `${config.label} this capsule` : "Увійдіть, щоб залишити реакцію"}
            >
              <div className={`transition-all ${active ? config.activeTextColor : config.textColor}`}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : config.getIcon()}
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
                {count > 0 && <span className={`text-xs font-bold ${config.activeTextColor}`}>{count}</span>}
              </div>
              {active && <div className="absolute inset-0 rounded-lg pointer-events-none animate-pulse opacity-20" />}
            </Button>
          )
        })}
      </div>

      {totalReactions === 0 && (
        <p className="text-center text-xs text-muted-foreground">Be the first to react to this capsule</p>
      )}
    </div>
  )
}
