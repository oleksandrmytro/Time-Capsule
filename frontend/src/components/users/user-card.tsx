import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPlus, UserMinus, Loader2, MessageCircle, Users, Timer } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { resolveAssetUrl } from "@/lib/asset-url"

export interface UserData {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  isFollowing?: boolean
  followersCount?: number
  followingCount?: number
  capsulesCount?: number
}

interface UserCardProps {
  user: UserData
  showFollowButton?: boolean
  showMessageButton?: boolean
  onFollow?: (userId: string) => Promise<boolean | void>
  onUnfollow?: (userId: string) => Promise<boolean | void>
  onMessage?: (userId: string) => void
  size?: "sm" | "md" | "lg"
  layout?: "row" | "column"
  currentUserId?: string
  appearance?: "default" | "dark"
}

export function UserCard({
  user,
  showFollowButton = true,
  showMessageButton = false,
  onFollow,
  onUnfollow,
  onMessage,
  size = "md",
  layout = "row",
  currentUserId,
  appearance = "default",
}: UserCardProps) {
  const isSelf = currentUserId === user.id
  const [isFollowing, setIsFollowing] = useState(isSelf ? false : user.isFollowing ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const isDark = appearance === "dark"

  const handleFollowToggle = async () => {
    if (isSelf) return
    setIsLoading(true)
    try {
      if (isFollowing) {
        const changed = await onUnfollow?.(user.id)
        if (changed === false) return
        setIsFollowing(false)
      } else {
        const changed = await onFollow?.(user.id)
        if (changed === false) return
        setIsFollowing(true)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  const handleMessage = () => {
    if (onMessage) {
      onMessage(user.id)
      return
    }
    navigate(`/chat/${user.id}`)
  }

  const avatarSizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }
  const nameSizes = { sm: "text-sm", md: "text-sm", lg: "text-base" }
  const canFollow = showFollowButton && !isSelf
  const canMessage = showMessageButton && !isSelf

  const followButtonClass = isDark
    ? isFollowing
      ? "border border-cyan-200/18 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14]"
      : "border border-cyan-300/28 bg-cyan-300/16 text-cyan-50 hover:bg-cyan-300/24"
    : ""
  const messageButtonClass = isDark
    ? "border border-cyan-200/18 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14]"
    : ""

  if (layout === "column") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-xl border p-3 text-center transition-all duration-300 sm:p-4 ${
          isDark
            ? "border-cyan-200/14 bg-[#17335f]/74 hover:border-cyan-300/32 hover:bg-[#1c4176]/82 hover:shadow-lg hover:shadow-cyan-400/12"
            : "border-border bg-card hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
        }`}
      >
        <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
          <Avatar className={`h-14 w-14 ring-2 sm:h-16 sm:w-16 ${isDark ? "ring-cyan-300/25" : "ring-accent/20"}`}>
            <AvatarImage src={resolveAssetUrl(user.avatar)} alt={user.displayName} />
            <AvatarFallback className={isDark ? "bg-cyan-300/15 text-lg font-bold text-cyan-100" : "bg-accent/10 text-lg font-bold text-accent"}>
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="min-w-0 w-full">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            className={`block w-full bg-transparent border-none p-0 text-center font-semibold transition-colors cursor-pointer ${
              isDark ? "text-slate-100 hover:text-cyan-100" : "text-card-foreground hover:text-accent"
            }`}
          >
            <span className="line-clamp-1 text-sm sm:text-base">{user.displayName}</span>
          </button>
          <p className={`line-clamp-1 text-xs ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>@{user.username}</p>
          {user.bio && <p className={`mt-1 line-clamp-2 text-xs ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>{user.bio}</p>}
        </div>

        {(user.followersCount !== undefined || user.capsulesCount !== undefined) && (
          <div className={`flex w-full justify-center gap-4 border-t pt-2 ${isDark ? "border-white/12" : "border-border"}`}>
            {user.followersCount !== undefined && (
              <div className="flex flex-col items-center gap-0.5">
                <div className={`flex items-center gap-1 text-xs font-semibold ${isDark ? "text-slate-100" : "text-card-foreground"}`}>
                  <Users className={`h-3 w-3 ${isDark ? "text-cyan-300" : "text-accent"}`} />
                  {user.followersCount}
                </div>
                <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>followers</span>
              </div>
            )}
            {user.capsulesCount !== undefined && (
              <div className="flex flex-col items-center gap-0.5">
                <div className={`flex items-center gap-1 text-xs font-semibold ${isDark ? "text-slate-100" : "text-card-foreground"}`}>
                  <Timer className={`h-3 w-3 ${isDark ? "text-cyan-300" : "text-accent"}`} />
                  {user.capsulesCount}
                </div>
                <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>capsules</span>
              </div>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-2">
          {canFollow && (
            <Button
              variant={isDark ? "ghost" : (isFollowing ? "outline" : "default")}
              size="sm"
              onClick={handleFollowToggle}
              disabled={isLoading}
              className={`w-full gap-1.5 text-xs sm:text-sm ${followButtonClass}`}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isFollowing ? (
                <><UserMinus className="h-3 w-3" /><span>Unfollow</span></>
              ) : (
                <><UserPlus className="h-3 w-3" /><span>Follow</span></>
              )}
            </Button>
          )}
          {canMessage && (
            <Button
              variant={isDark ? "ghost" : "outline"}
              size="sm"
              className={`w-full gap-1.5 text-xs sm:text-sm ${messageButtonClass}`}
              onClick={handleMessage}
            >
              <MessageCircle className="h-3 w-3" />
              <span>Message</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 sm:p-4 ${
        isDark
          ? "border-cyan-200/14 bg-[#17335f]/74 hover:border-cyan-300/32 hover:bg-[#1c4176]/82 hover:shadow-lg hover:shadow-cyan-400/12"
          : "border-border bg-card hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
      }`}
    >
      <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
        <Avatar className={avatarSizes[size]}>
          <AvatarImage src={resolveAssetUrl(user.avatar)} alt={user.displayName} />
          <AvatarFallback className={isDark ? "bg-cyan-300/15 text-cyan-100 font-bold" : "bg-accent/10 text-accent font-bold"}>
            {user.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => navigate(`/profile/${user.username}`)}
          className={`block truncate border-none bg-transparent p-0 text-left font-medium transition-colors cursor-pointer ${
            isDark ? "text-slate-100 hover:text-cyan-100" : "text-card-foreground hover:text-accent"
          }`}
        >
          <span className={nameSizes[size]}>{user.displayName}</span>
        </button>
        <p className={`truncate text-xs ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>@{user.username}</p>
        {(user.followersCount !== undefined || user.capsulesCount !== undefined) && (
          <div className="mt-1 flex items-center gap-3">
            {user.followersCount !== undefined && (
              <span className={`flex items-center gap-1 text-[11px] ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                <Users className="h-3 w-3" />
                {user.followersCount} followers
              </span>
            )}
            {user.capsulesCount !== undefined && (
              <span className={`flex items-center gap-1 text-[11px] ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                <Timer className="h-3 w-3" />
                {user.capsulesCount} capsules
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canMessage && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${isDark ? "text-slate-300 hover:bg-white/[0.1] hover:text-slate-100" : ""}`}
            onClick={handleMessage}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}
        {canFollow && (
          <Button
            variant={isDark ? "ghost" : (isFollowing ? "outline" : "default")}
            size="sm"
            onClick={handleFollowToggle}
            disabled={isLoading}
            className={`h-8 gap-1.5 text-xs ${followButtonClass}`}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isFollowing ? <><UserMinus className="h-3 w-3" />Unfollow</> : <><UserPlus className="h-3 w-3" />Follow</>}
          </Button>
        )}
      </div>
    </div>
  )
}
