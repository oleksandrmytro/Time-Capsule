import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Search, Loader2, MessageCircle } from "lucide-react"
import { getConversations, type ChatConversation, getFollowing, type UserPublic } from "@/services/api"
import { resolveAssetUrl } from "@/lib/asset-url"

interface ChatListProps {
  selectedUserId?: string
  currentUserId?: string
}

export function ChatList({ selectedUserId, currentUserId }: ChatListProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [following, setFollowing] = useState<UserPublic[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getConversations().then(setConversations).catch((err: any) => { throw err }),
      currentUserId ? getFollowing(currentUserId).then(setFollowing).catch(() => setFollowing([])) : Promise.resolve([])
    ]).catch((err: any) => {
      if (err?.status === 404 || err?.status === 500) {
        setError('Chat API is not available yet on the backend.')
      } else {
        setError(err?.message || 'Failed to load conversations')
      }
      setConversations([])
    }).finally(() => setLoading(false))
  }, [currentUserId])

  const filteredConvs = conversations.filter((conv) =>
    conv.user.displayName.toLowerCase().includes(search.toLowerCase()) || conv.user.username.toLowerCase().includes(search.toLowerCase())
  )
  const filteredFollowing = following.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  )

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp); const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" })
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const startable = filteredFollowing.filter(f => !conversations.some(c => c.user.id === f.id))
  const showEmptyConversations = filteredConvs.length === 0 && startable.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#15305e]/48">
      <div className="border-b border-cyan-200/10 bg-[#17335f]/42 p-4 sm:p-5">
        <h2 className="mb-3 font-serif text-lg font-semibold text-slate-100">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl border border-cyan-200/12 bg-white/[0.08] pl-9 text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-200/40 focus-visible:ring-1 focus-visible:ring-cyan-200/35"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-slate-400">
            {error}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.user.id}`)}
                className={`group flex w-full items-start gap-3 border-b border-cyan-200/8 bg-transparent px-4 py-3.5 text-left transition-colors ${selectedUserId === conv.user.id ? "bg-cyan-300/16 ring-1 ring-inset ring-cyan-200/28" : "hover:bg-white/[0.08]"}`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11 border border-cyan-200/14">
                    <AvatarImage src={resolveAssetUrl(conv.user.avatar)} />
                    <AvatarFallback className="bg-violet-400/18 text-cyan-100">
                      {conv.user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-slate-100">{conv.user.displayName}</p>
                    <span className="hidden shrink-0 text-xs text-slate-400 lg:inline">{formatTime(conv.lastMessage.timestamp)}</span>
                  </div>
                  <p className={`mt-0.5 min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere] text-sm leading-snug ${!conv.lastMessage.isRead && !conv.lastMessage.fromMe ? "font-medium text-slate-100" : "text-slate-400"}`}>
                    {conv.lastMessage.fromMe && "You: "}{conv.lastMessage.text}
                  </p>
                </div>
                {!conv.lastMessage.isRead && !conv.lastMessage.fromMe && (
                  <span className="mt-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/20 px-1.5 text-[10px] font-semibold text-cyan-100">
                    1
                  </span>
                )}
              </button>
            ))}

            {startable.length > 0 && (
              <div className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Start chat with followers</p>
                <div className="flex flex-col gap-2">
                  {startable.map(u => (
                    <button
                      key={u.id}
                      onClick={() => navigate(`/chat/${u.id}`)}
                      className="flex items-center gap-3 rounded-xl border border-cyan-200/12 bg-white/[0.06] px-3 py-2.5 text-left transition-colors hover:border-cyan-200/34 hover:bg-white/[0.1]"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 border border-white/10">
                          <AvatarImage src={resolveAssetUrl(u.avatar)} />
                          <AvatarFallback className="bg-violet-400/18 text-cyan-100">
                            {u.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{u.displayName}</p>
                        <p className="truncate text-xs text-slate-400">@{u.username}</p>
                      </div>
                      <MessageCircle className="h-4 w-4 text-cyan-200" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showEmptyConversations && (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-400">No conversations yet.</p>
                <p className="mt-1 text-xs text-slate-500">Start a chat from your followers list.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


