import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Loader2, ArrowLeft, MoreVertical, Package } from "lucide-react"
import { sendChatMessage, getUserProfile, getChatMessages, type ChatMessage } from "@/services/api"
import { setChatCallbacks, type ChatWsMessage } from "@/services/ws"

interface ChatWindowProps {
  userId: string
}

interface ChatUser {
  id: string
  username: string
  displayName: string
  avatar?: string
  isOnline: boolean
  lastSeen?: string
}

interface DisplayMessage extends ChatMessage {
  type?: 'text' | 'capsule_share'
  capsuleId?: string
  capsuleTitle?: string
}

export function ChatWindow({ userId }: ChatWindowProps) {
  const [user, setUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Load user profile
  useEffect(() => {
    setIsLoading(true)
    setMessages([]) // No persistence — start empty
    Promise.all([
      getUserProfile(userId)
        .then(p => setUser({ id: p.id, username: p.username || '', displayName: p.displayName || p.username || '', avatar: p.avatarUrl, isOnline: p.isOnline ?? false }))
        .catch(() => setUser({ id: userId, username: userId, displayName: userId, isOnline: false })),
      getChatMessages(userId).then((msgs) => setMessages(msgs as DisplayMessage[])).catch(() => setMessages([])),
    ])
      .finally(() => setIsLoading(false))
  }, [userId])

  // Subscribe to WS chat messages for this peer
  const handleWsMessage = useCallback((msg: ChatWsMessage) => {
    // Only show messages from the current peer
    if (msg.fromUserId === userId || msg.fromMe) {
      const dm: DisplayMessage = {
        id: msg.id,
        text: msg.text,
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        status: msg.status as any,
        type: msg.type,
        capsuleId: msg.capsuleId,
        capsuleTitle: msg.capsuleTitle,
      }
      setMessages(prev => [...prev, dm])
    }
  }, [userId])

  useEffect(() => {
    setChatCallbacks({ onMessage: handleWsMessage })
    return () => setChatCallbacks({})
  }, [handleWsMessage])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return
    const text = inputValue.trim(); setInputValue(""); setIsSending(true)
    try {
      const msg = await sendChatMessage(userId, text)
      // Add local message (WS echo may also arrive — deduplicate by id)
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, { ...msg, type: 'text' }]
      })
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), text, timestamp: new Date().toISOString(), fromMe: true, status: 'sent', type: 'text' }])
    }
    finally { setIsSending(false); inputRef.current?.focus() }
  }

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const formatDate = (ts: string) => {
    const d = new Date(ts); const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
  }

  const groupedMessages: { date: string; messages: DisplayMessage[] }[] = []
  let currentDate = ""
  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp).toDateString()
    if (msgDate !== currentDate) { currentDate = msgDate; groupedMessages.push({ date: msg.timestamp, messages: [msg] }) }
    else { groupedMessages[groupedMessages.length - 1].messages.push(msg) }
  })

  if (!user) return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>

  const showMessages = !isLoading || messages.length > 0

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => navigate('/chat')}><ArrowLeft className="h-5 w-5" /></Button>
        <button onClick={() => navigate(`/profile/${user.username}`)} className="relative shrink-0 bg-transparent border-none p-0 cursor-pointer">
          <Avatar className="h-10 w-10"><AvatarImage src={user.avatar} /><AvatarFallback className="bg-accent/10 text-accent">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          {user.isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate(`/profile/${user.username}`)} className="block truncate font-medium text-card-foreground hover:underline bg-transparent border-none p-0 cursor-pointer text-left">{user.displayName}</button>
          <p className="text-xs text-muted-foreground">{user.isOnline ? "Online" : "Offline"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/profile/${user.username}`)}>View Profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Avatar className="mb-3 h-16 w-16"><AvatarImage src={user.avatar} /><AvatarFallback className="bg-accent/10 text-xl text-accent">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <p className="font-medium text-foreground">{user.displayName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Start a conversation</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedMessages.map((group) => (
              <div key={group.date} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 py-2"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{formatDate(group.date)}</span><div className="h-px flex-1 bg-border" /></div>
                {group.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                    {msg.type === 'capsule_share' ? (
                      <button
                        onClick={() => msg.capsuleId && navigate(`/capsules/${msg.capsuleId}`)}
                        className={`max-w-[75%] rounded-2xl px-4 py-3 border cursor-pointer transition-colors text-left ${msg.fromMe ? "bg-primary/10 border-primary/30 hover:bg-primary/20" : "bg-accent/10 border-accent/30 hover:bg-accent/20"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-accent" />
                          <span className="text-xs font-semibold text-accent">Shared Capsule</span>
                        </div>
                        <p className="text-sm font-medium text-card-foreground">{msg.capsuleTitle || 'Capsule'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Tap to view</p>
                        <p className={`mt-1 text-[10px] ${msg.fromMe ? "text-primary/70" : "text-muted-foreground"}`}>{formatTime(msg.timestamp)}</p>
                      </button>
                    ) : (
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.fromMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={`mt-1 text-[10px] ${msg.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(msg.timestamp)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border bg-card p-4">
        <Input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Type a message..." className="flex-1" disabled={isSending} />
        <Button type="submit" size="icon" disabled={!inputValue.trim() || isSending}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}


