import { useState } from "react"
import { UserCard, type UserData } from "./user-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/empty-state"
import { Loader2, Users, UserCheck } from "lucide-react"

interface FollowersListProps {
  followers: UserData[]
  following: UserData[]
  followersCount: number
  followingCount: number
  onFollow: (userId: string) => Promise<void>
  onUnfollow: (userId: string) => Promise<void>
  onLoadMoreFollowers?: () => Promise<void>
  onLoadMoreFollowing?: () => Promise<void>
  hasMoreFollowers?: boolean
  hasMoreFollowing?: boolean
  currentUserId?: string
}

export function FollowersList({ followers, following, followersCount, followingCount, onFollow, onUnfollow, onLoadMoreFollowers, onLoadMoreFollowing, hasMoreFollowers = false, hasMoreFollowing = false, currentUserId }: FollowersListProps) {
  const [loadingFollowers, setLoadingFollowers] = useState(false)
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  const handleLoadMoreFollowers = async () => { setLoadingFollowers(true); await onLoadMoreFollowers?.(); setLoadingFollowers(false) }
  const handleLoadMoreFollowing = async () => { setLoadingFollowing(true); await onLoadMoreFollowing?.(); setLoadingFollowing(false) }

  return (
    <Tabs defaultValue="followers" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="followers" className="gap-2"><Users className="h-4 w-4" />Followers ({followersCount})</TabsTrigger>
        <TabsTrigger value="following" className="gap-2"><UserCheck className="h-4 w-4" />Following ({followingCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="followers" className="mt-4">
        {followers.length === 0 ? (
          <EmptyState icon={Users} title="No followers yet" description="When people follow you, they'll appear here." />
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {followers.map((user) => <UserCard key={user.id} user={user} showFollowButton showMessageButton onFollow={onFollow} onUnfollow={onUnfollow} currentUserId={currentUserId} />)}
            {hasMoreFollowers && <Button variant="outline" onClick={handleLoadMoreFollowers} disabled={loadingFollowers} className="mt-2">{loadingFollowers ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Load more"}</Button>}
          </div>
        )}
      </TabsContent>
      <TabsContent value="following" className="mt-4">
        {following.length === 0 ? (
          <EmptyState icon={UserCheck} title="Not following anyone" description="When you follow people, they'll appear here." />
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {following.map((user) => <UserCard key={user.id} user={user} showFollowButton showMessageButton onFollow={onFollow} onUnfollow={onUnfollow} currentUserId={currentUserId} />)}
            {hasMoreFollowing && <Button variant="outline" onClick={handleLoadMoreFollowing} disabled={loadingFollowing} className="mt-2">{loadingFollowing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Load more"}</Button>}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
