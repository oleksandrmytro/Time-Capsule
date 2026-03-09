import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPlus, UserMinus, Loader2, MessageCircle, Users, Timer } from "lucide-react"
import { useNavigate } from "react-router-dom"

export interface UserData {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  isFollowing?: boolean
  isOnline?: boolean
  followersCount?: number
  followingCount?: number
  capsulesCount?: number
}

interface UserCardProps {
  user: UserData
  showFollowButton?: boolean
  showMessageButton?: boolean
  onFollow?: (userId: string) => Promise<void>
  onUnfollow?: (userId: string) => Promise<void>
  size?: "sm" | "md" | "lg"
  layout?: "row" | "column"
  currentUserId?: string
}

export function UserCard({ user, showFollowButton = true, showMessageButton = false, onFollow, onUnfollow, size = "md", layout = "row", currentUserId }: UserCardProps) {
  const isSelf = currentUserId === user.id
  const [isFollowing, setIsFollowing] = useState(isSelf ? false : user.isFollowing ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleFollowToggle = async () => {
    if (isSelf) return
    setIsLoading(true)
    try {
      if (isFollowing) { await onUnfollow?.(user.id); setIsFollowing(false) }
      else { await onFollow?.(user.id); setIsFollowing(true) }
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }

  const avatarSizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }
  const nameSizes = { sm: "text-sm", md: "text-sm", lg: "text-base" }
  const canFollow = showFollowButton && !isSelf
  const canMessage = showMessageButton && !isSelf

  // Column layout for grid view
  if (layout === "column") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10">
        <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
          <Avatar className="h-16 w-16 ring-2 ring-accent/20">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback className="bg-accent/10 text-lg font-bold text-accent">
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card bg-success" />
          )}
        </button>

        <div className="min-w-0 w-full">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            className="block w-full font-semibold text-card-foreground hover:text-accent transition-colors bg-transparent border-none p-0 cursor-pointer text-center"
          >
            <span className="line-clamp-1 text-sm sm:text-base">{user.displayName}</span>
          </button>
          <p className="line-clamp-1 text-xs text-muted-foreground">@{user.username}</p>
          {user.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{user.bio}</p>}
        </div>

        {/* Статистика: підписники та капсули */}
        {(user.followersCount !== undefined || user.capsulesCount !== undefined) && (
          <div className="flex w-full justify-center gap-4 border-t border-border pt-2">
            {user.followersCount !== undefined && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1 text-xs font-semibold text-card-foreground">
                  <Users className="h-3 w-3 text-accent" />
                  {user.followersCount}
                </div>
                <span className="text-[10px] text-muted-foreground">followers</span>
              </div>
            )}
            {user.capsulesCount !== undefined && (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1 text-xs font-semibold text-card-foreground">
                  <Timer className="h-3 w-3 text-accent" />
                  {user.capsulesCount}
                </div>
                <span className="text-[10px] text-muted-foreground">capsules</span>
              </div>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-2">
          {canFollow && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              onClick={handleFollowToggle}
              disabled={isLoading}
              className="w-full gap-1.5 text-xs sm:text-sm"
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
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs sm:text-sm" onClick={() => navigate(`/chat/${user.id}`)}>
              <MessageCircle className="h-3 w-3" />
              <span>Message</span>
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Row layout for list view (default)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10">
      <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
        <Avatar className={avatarSizes[size]}>
          <AvatarImage src={user.avatar} alt={user.displayName} />
          <AvatarFallback className="bg-accent/10 text-accent font-bold">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={() => navigate(`/profile/${user.username}`)} className="block truncate font-medium text-card-foreground hover:text-accent transition-colors bg-transparent border-none p-0 cursor-pointer text-left">
          <span className={nameSizes[size]}>{user.displayName}</span>
        </button>
        <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
        {/* Статистика в рядковому режимі */}
        {(user.followersCount !== undefined || user.capsulesCount !== undefined) && (
          <div className="mt-1 flex items-center gap-3">
            {user.followersCount !== undefined && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {user.followersCount} followers
              </span>
            )}
            {user.capsulesCount !== undefined && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Timer className="h-3 w-3" />
                {user.capsulesCount} capsules
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canMessage && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/chat/${user.id}`)}>
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}
        {canFollow && (
          <Button variant={isFollowing ? "outline" : "default"} size="sm" onClick={handleFollowToggle} disabled={isLoading} className="h-8 gap-1.5 text-xs">
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isFollowing ? <><UserMinus className="h-3 w-3" />Unfollow</> : <><UserPlus className="h-3 w-3" />Follow</>}
          </Button>
        )}
      </div>
    </div>
  )
}

