import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Search, Loader2, MessageCircle } from "lucide-react"
import { getConversations, type ChatConversation, getFollowing, type UserPublic } from "@/services/api"

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

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="mb-3 font-serif text-lg font-semibold text-card-foreground">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredConvs.map((conv) => (
              <button key={conv.id} onClick={() => navigate(`/chat/${conv.user.id}`)}
                className={`flex items-start gap-3 border-b border-border p-4 transition-colors hover:bg-muted/50 w-full text-left bg-transparent ${selectedUserId === conv.user.id ? "bg-muted" : ""}`}>
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11"><AvatarImage src={conv.user.avatar} /><AvatarFallback className="bg-accent/10 text-accent">{conv.user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  {conv.user.isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-card-foreground">{conv.user.displayName}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatTime(conv.lastMessage.timestamp)}</span>
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${!conv.lastMessage.isRead && !conv.lastMessage.fromMe ? "font-medium text-card-foreground" : "text-muted-foreground"}`}>
                    {conv.lastMessage.fromMe && "You: "}{conv.lastMessage.text}
                  </p>
                </div>
                {!conv.lastMessage.isRead && !conv.lastMessage.fromMe && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}

            {startable.length > 0 && (
              <div className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Start chat with followers</p>
                <div className="flex flex-col gap-2">
                  {startable.map(u => (
                    <button key={u.id} onClick={() => navigate(`/chat/${u.id}`)}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/50">
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9"><AvatarImage src={u.avatar} /><AvatarFallback className="bg-accent/10 text-accent">{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-card-foreground">{u.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}


