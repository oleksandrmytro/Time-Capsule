import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPlus, UserMinus, Loader2, MessageCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

export interface UserData {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  isFollowing?: boolean
  isOnline?: boolean
}

interface UserCardProps {
  user: UserData
  showFollowButton?: boolean
  showMessageButton?: boolean
  onFollow?: (userId: string) => Promise<void>
  onUnfollow?: (userId: string) => Promise<void>
  size?: "sm" | "md" | "lg"
}

export function UserCard({ user, showFollowButton = true, showMessageButton = false, onFollow, onUnfollow, size = "md" }: UserCardProps) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleFollowToggle = async () => {
    setIsLoading(true)
    try {
      if (isFollowing) { await onUnfollow?.(user.id); setIsFollowing(false) }
      else { await onFollow?.(user.id); setIsFollowing(true) }
    } catch { /* ignore */ } finally { setIsLoading(false) }
  }

  const avatarSizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }
  const nameSizes = { sm: "text-sm", md: "text-sm", lg: "text-base" }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50">
      <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
        <Avatar className={avatarSizes[size]}>
          <AvatarImage src={user.avatar} alt={user.displayName} />
          <AvatarFallback className="bg-accent/10 text-accent">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={() => navigate(`/profile/${user.username}`)} className="block truncate font-medium text-card-foreground hover:underline bg-transparent border-none p-0 cursor-pointer text-left">
          <span className={nameSizes[size]}>{user.displayName}</span>
        </button>
        <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showMessageButton && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/chat/${user.id}`)}>
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}
        {showFollowButton && (
          <Button variant={isFollowing ? "outline" : "default"} size="sm" onClick={handleFollowToggle} disabled={isLoading} className="h-8 gap-1.5 text-xs">
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isFollowing ? <><UserMinus className="h-3 w-3" />Unfollow</> : <><UserPlus className="h-3 w-3" />Follow</>}
          </Button>
        )}
      </div>
    </div>
  )
}

