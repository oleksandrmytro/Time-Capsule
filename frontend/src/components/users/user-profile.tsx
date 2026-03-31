import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProfileCapsulesGrid } from "@/components/capsules/profile-capsules-grid"
import { ProfileUsersGrid } from "@/components/users/profile-users-grid"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import {
  UserPlus,
  UserMinus,
  MessageCircle,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Loader2,
  Users,
  UserCheck,
} from "lucide-react"
import { followUser, unfollowUser } from "@/services/api"
import type { UserProfile, Capsule } from "@/services/api"
import type { UserData } from "./user-card"

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
  const [activeTab, setActiveTab] = useState<"capsules" | "followers" | "following">("capsules")
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
        setFollowersCount((previous) => Math.max(0, previous - 1))
        setIsFollowing(false)
      } else {
        await followUser(user.id)
        setFollowersCount((previous) => previous + 1)
        setIsFollowing(true)
      }
    } catch {
      // ignore
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
  const followingCount = user.followingCount ?? following.length

  return (
    <section className="relative isolate overflow-hidden bg-[#050816] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.18] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.74)_0%,rgba(3,8,20,0.84)_58%,rgba(3,8,22,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(94,230,255,0.08)_0%,rgba(94,230,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(124,92,255,0.1)_0%,rgba(124,92,255,0)_44%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/14 bg-slate-950/55 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <Avatar className="h-24 w-24 border border-white/20 shadow-[0_12px_34px_rgba(15,23,42,0.42)] sm:h-28 sm:w-28">
                  <AvatarImage src={user.avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-white/10 text-2xl font-bold text-slate-100">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="min-w-0 space-y-2 text-center sm:text-left">
                <h1 className="truncate font-serif text-2xl font-bold text-slate-100 sm:text-3xl">{displayName}</h1>
                <p className="truncate text-sm text-slate-300 sm:text-base">@{user.username}</p>
                {user.bio && <p className="max-w-2xl text-sm leading-relaxed text-slate-200">{user.bio}</p>}
                <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400 sm:justify-start sm:text-sm">
                  {user.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {user.location}
                    </span>
                  )}
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-cyan-200 transition-colors hover:text-cyan-100"
                    >
                      <LinkIcon className="h-4 w-4" />
                      {user.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {user.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Joined {formatDate(user.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
              {!isSelfProfile && (
                <>
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    onClick={handleFollowToggle}
                    disabled={isLoading}
                    size="sm"
                    className="gap-2 border-white/18 bg-white/[0.05] text-slate-100 hover:bg-white/[0.12]"
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
                    className="gap-2 border-cyan-300/28 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/18"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Message</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("capsules")}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeTab === "capsules"
                  ? "border-cyan-300/40 bg-cyan-300/15"
                  : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <p className="text-xl font-bold text-slate-100">{actualCapsulesCount}</p>
              <p className="text-xs text-slate-400 sm:text-sm">Capsules</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("followers")}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeTab === "followers"
                  ? "border-cyan-300/40 bg-cyan-300/15"
                  : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <p className="text-xl font-bold text-slate-100">{followersCount}</p>
              <p className="text-xs text-slate-400 sm:text-sm">Followers</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("following")}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeTab === "following"
                  ? "border-cyan-300/40 bg-cyan-300/15"
                  : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <p className="text-xl font-bold text-slate-100">{followingCount}</p>
              <p className="text-xs text-slate-400 sm:text-sm">Following</p>
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/14 bg-slate-950/52 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.5)] backdrop-blur-xl sm:p-6">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="capsules" className="mt-0">
              <ProfileCapsulesGrid capsules={capsules} isOwnProfile={isSelfProfile} username={user.username || "user"} />
            </TabsContent>

            <TabsContent value="followers" className="mt-0">
              <ProfileUsersGrid
                users={followers}
                heading={`${followers.length} follower${followers.length !== 1 ? "s" : ""}`}
                subtitle="Followers"
                emptyIcon={Users}
                emptyTitle="No followers yet"
                emptyDescription={
                  isSelfProfile
                    ? "When people follow you, they will appear here."
                    : `@${user.username} has no followers yet.`
                }
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
                currentUserId={currentUserId}
              />
            </TabsContent>

            <TabsContent value="following" className="mt-0">
              <ProfileUsersGrid
                users={following}
                heading={`${following.length} following`}
                subtitle="Following"
                emptyIcon={UserCheck}
                emptyTitle="Not following anyone"
                emptyDescription={
                  isSelfProfile
                    ? "Profiles you follow will be listed here."
                    : `@${user.username} is not following anyone yet.`
                }
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
                currentUserId={currentUserId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  )
}
