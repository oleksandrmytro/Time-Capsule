import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { UserCard, type UserData } from "./user-card"
import { ProfileCapsulesGrid } from "@/components/capsules/profile-capsules-grid"
import { ProfileUsersGrid } from "@/components/users/profile-users-grid"
import { EmptyState } from "@/components/empty-state"
import {
  UserPlus,
  UserMinus,
  MessageCircle,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Loader2,
  Settings,
  Timer,
  Users,
  UserCheck,
  Grid3X3,
  List,
} from "lucide-react"
import { followUser, unfollowUser } from "@/services/api"
import type { UserProfile, Capsule } from "@/services/api"

interface UserProfileViewProps {
  user: UserProfile
  isOwnProfile?: boolean
  capsulesCount?: number
  followers?: UserData[]
  following?: UserData[]
  capsules?: Capsule[]
  onFollow?: (userId: string) => Promise<void>
  onUnfollow?: (userId: string) => Promise<void>
  currentUserId?: string
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

export function UserProfileView({
  user,
  isOwnProfile = false,
  capsulesCount,
  followers = [],
  following = [],
  capsules = [],
  onFollow,
  onUnfollow,
  currentUserId,
}: UserProfileViewProps) {
  const isSelfProfile = isOwnProfile || (currentUserId ? user.id === currentUserId : false)
  const [isFollowing, setIsFollowing] = useState(isSelfProfile ? false : user.isFollowing ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(user.followersCount ?? 0)
  const [activeTab, setActiveTab] = useState("capsules")
  const navigate = useNavigate()

  useEffect(() => {
    setIsFollowing(isSelfProfile ? false : user.isFollowing ?? false)
    setFollowersCount(user.followersCount ?? 0)
  }, [user, isSelfProfile])

  const handleFollowToggle = async () => {
    if (isSelfProfile) return
    setIsLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(user.id)
        setFollowersCount((p) => Math.max(0, p - 1))
        setIsFollowing(false)
      } else {
        await followUser(user.id)
        setFollowersCount((p) => p + 1)
        setIsFollowing(true)
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollow = async (userId: string) => {
    if (onFollow) await onFollow(userId)
    else await followUser(userId)
  }

  const handleUnfollow = async (userId: string) => {
    if (onUnfollow) await onUnfollow(userId)
    else await unfollowUser(userId)
  }

  const displayName = user.displayName || user.username || "User"
  const actualCapsulesCount = capsulesCount ?? user.capsulesCount ?? capsules.length ?? 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        {/* Profile Header Section */}
        <div className="w-full">
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 ring-2 ring-accent/20 sm:h-24 sm:w-24 md:h-28 md:w-28">
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-accent/10 text-2xl font-bold text-accent">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {user.isOnline && (
                  <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-success shadow-lg" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                {/* Name and username */}
                <div className="mb-3">
                  <h1 className="text-xl font-bold tracking-tight text-card-foreground sm:text-2xl md:text-3xl">
                    {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    @{user.username}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:gap-2">
                  {!isSelfProfile && (
                    <>
                      <Button
                        variant={isFollowing ? "outline" : "default"}
                        onClick={handleFollowToggle}
                        disabled={isLoading}
                        size="sm"
                        className="flex-1 gap-2 sm:flex-none"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <UserMinus className="h-4 w-4" />
                            <span>Unfollow</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            <span>Follow</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/chat/${user.id}`)}
                        size="sm"
                        className="flex-1 gap-2 sm:flex-none"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Message</span>
                      </Button>
                    </>
                  )}

                  {isSelfProfile && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/account/settings")}
                      size="sm"
                      className="flex-1 gap-2 sm:flex-none"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Edit Profile</span>
                    </Button>
                  )}
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="mb-3 text-sm leading-relaxed text-card-foreground sm:text-base">
                    {user.bio}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-4">
                  {user.location && (
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{user.location}</span>
                    </span>
                  )}
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-accent transition-colors hover:text-accent/80 hover:underline sm:justify-start"
                    >
                      <LinkIcon className="h-4 w-4 shrink-0" />
                      <span>{user.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {user.createdAt && (
                    <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>Joined {formatDate(user.createdAt)}</span>
                    </span>
                  )}
                </div>

                {/* Stats Bar (controls tabs) */}
                <div className="mt-5 mb-3 grid grid-cols-3 gap-0 rounded-xl border border-border bg-card/50 shadow-sm">
                  <button
                    onClick={() => setActiveTab("capsules")}
                    className={`flex flex-col items-center gap-1 px-3 py-3.5 transition-all duration-200 hover:bg-muted/50 sm:py-4 rounded-l-xl ${
                      activeTab === "capsules"
                        ? "border-b-2 border-accent bg-accent/5"
                        : "border-b-2 border-transparent"
                    }`}
                  >
                    <span className="text-base font-bold text-card-foreground sm:text-lg md:text-xl">
                      {actualCapsulesCount}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                      Capsules
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("followers")}
                    className={`flex flex-col items-center gap-1 border-x border-border px-3 py-3.5 transition-all duration-200 hover:bg-muted/50 sm:py-4 ${
                      activeTab === "followers"
                        ? "border-b-2 border-accent bg-accent/5"
                        : "border-b-2 border-transparent"
                    }`}
                  >
                    <span className="text-base font-bold text-card-foreground sm:text-lg md:text-xl">
                      {followersCount}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                      Followers
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("following")}
                    className={`flex flex-col items-center gap-1 px-3 py-3.5 transition-all duration-200 hover:bg-muted/50 sm:py-4 rounded-r-xl ${
                      activeTab === "following"
                        ? "border-b-2 border-accent bg-accent/5"
                        : "border-b-2 border-transparent"
                    }`}
                  >
                    <span className="text-base font-bold text-card-foreground sm:text-lg md:text-xl">
                      {user.followingCount ?? 0}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                      Following
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs content */}
          <div className="w-full mt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab triggers hidden: stats bar above controls activeTab */}
              {/* Removed TabsList to hide the tab buttons */}

              {/* Capsules Tab */}
              <TabsContent value="capsules" className="mt-0">
                <ProfileCapsulesGrid
                  capsules={capsules}
                  isOwnProfile={isOwnProfile}
                  username={user.username || "user"}
                />
              </TabsContent>

              {/* Followers Tab */}
              <TabsContent value="followers" className="mt-2">
                <ProfileUsersGrid
                  users={followers}
                  heading={`${followers.length} follower${followers.length !== 1 ? "s" : ""}`}
                  subtitle="Followers"
                  emptyIcon={Users}
                  emptyTitle="No followers yet"
                  emptyDescription={
                    isSelfProfile
                      ? "When people follow you, they'll appear here."
                      : `@${user.username} doesn't have any followers yet.`
                  }
                  onFollow={handleFollow}
                  onUnfollow={handleUnfollow}
                  currentUserId={currentUserId}
                />
              </TabsContent>

              {/* Following Tab */}
              <TabsContent value="following" className="mt-2">
                <ProfileUsersGrid
                  users={following}
                  heading={`${following.length} following`}
                  subtitle="Following"
                  emptyIcon={UserCheck}
                  emptyTitle="Not following anyone"
                  emptyDescription={
                    isSelfProfile
                      ? "When you follow people, they'll appear here."
                      : `@${user.username} isn't following anyone yet.`
                  }
                  onFollow={handleFollow}
                  onUnfollow={handleUnfollow}
                  currentUserId={currentUserId}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

