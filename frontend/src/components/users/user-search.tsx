import { useState, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { UserCard, type UserData } from "./user-card"
import { EmptyState } from "@/components/empty-state"
import { Search, Loader2, Users, AlertTriangle } from "lucide-react"
import { searchUsers, followUser, unfollowUser } from "@/services/api"

interface UserSearchProps {
  currentUserId?: string
}

export function UserSearch({ currentUserId }: UserSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); setHasSearched(false); setSearchError(null); return }
    setIsSearching(true); setHasSearched(true); setSearchError(null)
    try {
      const data = await searchUsers(searchQuery)
      setResults(Array.isArray(data) ? data.map(u => ({ ...u, displayName: u.displayName || u.username })) : [])
    } catch (err: any) {
      setResults([])
      if (err?.status === 404) {
        setSearchError("Search API is not available yet. This feature requires backend support.")
      } else {
        setSearchError(err?.message || "Search failed")
      }
    }
    finally { setIsSearching(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 400)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  const handleFollow = async (userId: string) => {
    try {
      await followUser(userId)
      setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: true } : u))
    } catch {}
  }
  const handleUnfollow = async (userId: string) => {
    try {
      await unfollowUser(userId)
      setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: false } : u))
    } catch {}
  }

  const visibleResults = currentUserId ? results.filter(u => u.id !== currentUserId) : results

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <h1 className="mb-6 font-serif text-3xl font-bold tracking-tight text-foreground">Search Users</h1>
      <div className="flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or name..." className="h-12 pl-12 text-base" />
          {isSearching && <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-2">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Users className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="font-medium text-foreground">Find People</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">Search for users by their username or display name to connect and share capsules.</p>
            </div>
          ) : isSearching ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : searchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><AlertTriangle className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="font-medium text-foreground">Search Unavailable</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{searchError}</p>
            </div>
          ) : visibleResults.length === 0 ? (
            <EmptyState icon={Search} title="No users found" description={`No users match "${query}". Try a different search term.`} />
          ) : (
            <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">{visibleResults.length} user{visibleResults.length !== 1 ? "s" : ""} found</p>
              {visibleResults.map((user) => <UserCard key={user.id} user={user} showFollowButton showMessageButton onFollow={handleFollow} onUnfollow={handleUnfollow} size="lg" currentUserId={currentUserId} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

