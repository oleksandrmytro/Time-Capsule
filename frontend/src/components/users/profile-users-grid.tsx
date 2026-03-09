import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { UserCard, type UserData } from "./user-card"
import { Grid3X3, List, type LucideIcon } from "lucide-react"

interface ProfileUsersGridProps {
  users: UserData[]
  heading: string
  subtitle?: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  onFollow?: (userId: string) => Promise<void>
  onUnfollow?: (userId: string) => Promise<void>
  currentUserId?: string
}

export function ProfileUsersGrid({
  users,
  heading,
  subtitle,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  onFollow,
  onUnfollow,
  currentUserId,
}: ProfileUsersGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  if (users.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold text-card-foreground">
             {heading}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          <Button
            type="button"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="sr-only">Grid</span>
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List</span>
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              showFollowButton
              showMessageButton
              onFollow={onFollow}
              onUnfollow={onUnfollow}
              layout="column"
              currentUserId={currentUserId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              showFollowButton
              showMessageButton
              onFollow={onFollow}
              onUnfollow={onUnfollow}
              layout="row"
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

