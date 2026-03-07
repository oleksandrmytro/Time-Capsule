import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { UserPlus, UserMinus, MessageCircle, Calendar, MapPin, Link as LinkIcon, Loader2, Settings } from "lucide-react"
import { followUser, unfollowUser } from "@/services/api"
import type { UserProfile } from "@/services/api"

interface UserProfileViewProps {
  user: UserProfile
  isOwnProfile?: boolean
  capsulesCount?: number
}

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" })

export function UserProfileView({ user, isOwnProfile = false, capsulesCount }: UserProfileViewProps) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(user.followersCount ?? 0)
  const navigate = useNavigate()

  useEffect(() => {
    setIsFollowing(user.isFollowing ?? false)
    setFollowersCount(user.followersCount ?? 0)
  }, [user])

  const handleFollowToggle = async () => {
    setIsLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(user.id)
        setFollowersCount(p => Math.max(0, p - 1))
        setIsFollowing(false)
      } else {
        await followUser(user.id)
        setFollowersCount(p => p + 1)
        setIsFollowing(true)
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  const displayName = user.displayName || user.username || 'User'
  const actualCapsulesCount = capsulesCount ?? user.capsulesCount ?? 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                <AvatarImage src={user.avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-accent/10 text-2xl text-accent">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-serif text-2xl font-bold text-card-foreground">{displayName}</h1>
                  <p className="text-muted-foreground">@{user.username}</p>
                  {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
                </div>
                {isOwnProfile && <Button variant="outline" onClick={() => navigate('/account/settings')} className="gap-1.5"><Settings className="h-4 w-4" />Settings</Button>}
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <Button variant={isFollowing ? "outline" : "default"} onClick={handleFollowToggle} disabled={isLoading} className="gap-1.5">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowing ? <><UserMinus className="h-4 w-4" />Unfollow</> : <><UserPlus className="h-4 w-4" />Follow</>}
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/chat/${user.id}`)} className="gap-1.5"><MessageCircle className="h-4 w-4" />Message</Button>
                  </div>
                )}
              </div>
              {user.bio && <p className="mt-4 text-sm leading-relaxed text-card-foreground">{user.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {user.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{user.location}</span>}
                {user.website && <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent"><LinkIcon className="h-4 w-4" />{user.website.replace(/^https?:\/\//, "")}</a>}
                {user.createdAt && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Joined {formatDate(user.createdAt)}</span>}
              </div>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-card-foreground">{actualCapsulesCount}</p><p className="text-xs text-muted-foreground">Capsules</p></div>
            <div><p className="text-2xl font-bold text-card-foreground">{followersCount}</p><p className="text-xs text-muted-foreground">Followers</p></div>
            <div><p className="text-2xl font-bold text-card-foreground">{user.followingCount ?? 0}</p><p className="text-xs text-muted-foreground">Following</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}


