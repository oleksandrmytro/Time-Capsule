import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { UserCard, type UserData } from "./user-card"
import { EmptyState } from "@/components/empty-state"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import { Search, Loader2, Users, AlertTriangle, ChevronLeft, ChevronRight, UserPlus } from "lucide-react"
import { getSuggestedUsers, searchUsers, followUser, unfollowUser } from "@/services/api"

interface UserSearchProps {
  currentUserId?: string
  showInitialUsers?: boolean
  title?: string
  subtitle?: string
}

export function UserSearch({
  currentUserId,
  showInitialUsers = false,
  title = "Search Users",
  subtitle = "Search for users by their username or display name to connect and share capsules.",
}: UserSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<UserData[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const suggestionsRailRef = useRef<HTMLDivElement | null>(null)

  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery && !showInitialUsers) { setResults([]); setHasSearched(false); setSearchError(null); return }
    setIsSearching(true); setHasSearched(true); setSearchError(null)
    try {
      const data = await searchUsers(trimmedQuery)
      setResults(
        Array.isArray(data)
          ? data.map((u: any) => ({
              ...u,
              avatar: u.avatar || u.avatarUrl,
              displayName: u.displayName || u.username,
            }))
          : []
      )
    } catch (err: any) {
      setResults([])
      if (err?.status === 404) {
        setSearchError("Search API is not available yet. This feature requires backend support.")
      } else {
        setSearchError(err?.message || "Search failed")
      }
    }
    finally { setIsSearching(false) }
  }, [showInitialUsers])

  useEffect(() => {
    if (!currentUserId) {
      setSuggestions([])
      return
    }

    let cancelled = false
    setIsLoadingSuggestions(true)
    getSuggestedUsers()
      .then((data) => {
        if (cancelled) return
        setSuggestions(
          Array.isArray(data)
            ? data.map((u: any) => ({
                ...u,
                avatar: u.avatar || u.avatarUrl,
                displayName: u.displayName || u.username,
              }))
            : []
        )
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUserId])

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 400)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  const handleFollow = async (userId: string): Promise<boolean> => {
    if (!currentUserId) {
      navigate("/login")
      return false
    }
    try {
      await followUser(userId)
      setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: true } : u))
      setSuggestions(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: true } : u))
      return true
    } catch {
      return false
    }
  }
  const handleUnfollow = async (userId: string): Promise<boolean> => {
    if (!currentUserId) {
      navigate("/login")
      return false
    }
    try {
      await unfollowUser(userId)
      setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: false } : u))
      setSuggestions(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: false } : u))
      return true
    } catch {
      return false
    }
  }
  const handleMessage = (userId: string) => {
    if (!currentUserId) {
      navigate("/login")
      return
    }
    navigate(`/chat/${userId}`)
  }

  const suggestionIds = useMemo(() => new Set(suggestions.map((user) => user.id)), [suggestions])
  const visibleResults = useMemo(() => {
    const base = currentUserId ? results.filter((u) => u.id !== currentUserId) : results
    if (query.trim()) return base
    return base.filter((u) => !suggestionIds.has(u.id))
  }, [currentUserId, results, query, suggestionIds])

  const scrollSuggestions = (direction: "left" | "right") => {
    const rail = suggestionsRailRef.current
    if (!rail) return
    const delta = direction === "left" ? -320 : 320
    rail.scrollBy({ left: delta, behavior: "smooth" })
  }

  return (
    <section className="relative isolate min-h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#0c1f45] px-4 py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.23] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,20,46,0.56)_0%,rgba(9,18,40,0.68)_58%,rgba(8,16,34,0.8)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(124,92,255,0.18)_0%,rgba(124,92,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(94,230,255,0.18)_0%,rgba(94,230,255,0)_40%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl text-slate-100">
        <h1 className="mb-3 font-serif text-3xl font-bold tracking-tight text-slate-100">{title}</h1>
        <p className="mb-6 max-w-2xl text-sm text-slate-300">{subtitle}</p>
        <div className="flex flex-col gap-6">
          <div className="relative rounded-3xl border border-cyan-200/12 bg-[#11254f]/62 p-4 shadow-[0_24px_70px_rgba(6,18,42,0.34)] backdrop-blur-xl sm:p-5">
            <Search className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or name..." className="h-12 border-cyan-200/12 bg-white/[0.05] pl-12 text-base text-slate-100 placeholder:text-slate-400" />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-slate-300" />}
          </div>

          {currentUserId && (
            <section className="rounded-3xl border border-cyan-200/12 bg-[#11254f]/62 p-4 shadow-[0_24px_70px_rgba(6,18,42,0.34)] backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/16 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                    <UserPlus className="h-3.5 w-3.5" />
                    People You May Know
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Based on your network: followers and people connected to accounts you already follow.
                  </p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => scrollSuggestions("left")}
                    className="h-10 w-10 rounded-full border border-cyan-200/18 bg-[#17335f]/78 text-slate-100 hover:border-cyan-200/38 hover:bg-cyan-300/18 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => scrollSuggestions("right")}
                    className="h-10 w-10 rounded-full border border-cyan-200/18 bg-[#17335f]/78 text-slate-100 hover:border-cyan-200/38 hover:bg-cyan-300/18 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isLoadingSuggestions ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-cyan-100" /></div>
              ) : suggestions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-sm text-slate-300">
                  Suggestions will appear when your social graph grows a bit more.
                </div>
              ) : (
                <div
                  ref={suggestionsRailRef}
                  className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {suggestions.map((user) => (
                    <div key={user.id} className="min-w-[220px] max-w-[220px] shrink-0">
                      <UserCard
                        user={user}
                        showFollowButton
                        showMessageButton
                        onFollow={handleFollow}
                        onUnfollow={handleUnfollow}
                        onMessage={handleMessage}
                        currentUserId={currentUserId}
                        appearance="dark"
                        layout="column"
                        size="md"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="flex flex-col gap-2">
            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-cyan-200/12 bg-[#11254f]/62 py-14 text-center shadow-[0_24px_70px_rgba(6,18,42,0.34)] backdrop-blur-xl">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-200/18 bg-cyan-300/14"><Users className="h-8 w-8 text-cyan-100" /></div>
                <h3 className="font-medium text-slate-100">Find People</h3>
                <p className="mt-1 max-w-xs text-sm text-slate-300">Search for specific profiles or browse the full community below.</p>
              </div>
            ) : isSearching ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
            ) : searchError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200"><AlertTriangle className="h-8 w-8 text-slate-600" /></div>
                <h3 className="font-medium text-slate-100">Search Unavailable</h3>
                <p className="mt-1 max-w-xs text-sm text-slate-300">{searchError}</p>
              </div>
            ) : visibleResults.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No users found"
                description={`No users match "${query}". Try a different search term.`}
                appearance="dark"
              />
            ) : (
              <div className="mx-auto flex w-full flex-col gap-3">
                <p className="text-sm text-slate-300">
                  {query.trim()
                    ? `${visibleResults.length} user${visibleResults.length !== 1 ? "s" : ""} found`
                    : `Showing ${visibleResults.length} more users`}
                </p>
                {visibleResults.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    showFollowButton
                    showMessageButton
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    onMessage={handleMessage}
                    size="lg"
                    currentUserId={currentUserId}
                    appearance="dark"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

