import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Loader2, ArrowLeft, MoreVertical, Package, Reply, X, CornerDownRight, Paperclip } from "lucide-react"
import {
  getApiBase,
  getChatMessages,
  getUserProfile,
  sendChatMessage,
  uploadChatAttachment,
  type ChatMessage,
} from "@/services/api"
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
}

type DisplayMessage = ChatMessage

export function ChatWindow({ userId }: ChatWindowProps) {
  const [user, setUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [failedMediaUrls, setFailedMediaUrls] = useState<Record<string, true>>({})

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setSendError(null)
    setMessages([])

    Promise.all([
      getUserProfile(userId)
        .then((profile) => {
          if (!active) return
          setUser({
            id: profile.id,
            username: profile.username || "",
            displayName: profile.displayName || profile.username || userId,
            avatar: profile.avatarUrl,
            isOnline: profile.isOnline ?? false,
          })
        })
        .catch(() => {
          if (!active) return
          setUser({ id: userId, username: userId, displayName: userId, isOnline: false })
        }),
      getChatMessages(userId)
        .then((items) => {
          if (active) setMessages(items as DisplayMessage[])
        })
        .catch(() => {
          if (active) setMessages([])
        }),
    ]).finally(() => {
      if (active) setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [userId])

  const handleWsMessage = useCallback(
    (msg: ChatWsMessage) => {
      if (msg.fromUserId !== userId && !msg.fromMe) return
      const normalizedType = msg.type || msg.mediaKind || "text"

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [
          ...prev,
          {
            id: msg.id,
            text: msg.text || "",
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            status: msg.status as DisplayMessage["status"],
            type: normalizedType,
            capsuleId: msg.capsuleId || null,
            capsuleTitle: msg.capsuleTitle || null,
            replyToMessageId: msg.replyToMessageId || null,
            mediaUrl: msg.mediaUrl || null,
            mediaKind: msg.mediaKind || null,
            mimeType: msg.mimeType || null,
          },
        ]
      })
    },
    [userId],
  )

  useEffect(() => {
    setChatCallbacks({ onMessage: handleWsMessage })
    return () => setChatCallbacks({})
  }, [handleWsMessage])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  const clearAttachment = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleAttachmentPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setSendError("Only image and video attachments are supported.")
      e.target.value = ""
      return
    }

    setSendError(null)
    setSelectedFile(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = inputValue.trim()
    if ((!text && !selectedFile) || isSending || isUploading) return

    const replyToMessageId = replyTo?.id || null
    setSendError(null)
    setIsSending(true)

    let mediaPayload: {
      mediaUrl?: string | null
      mediaKind?: "image" | "video" | null
      mimeType?: string | null
    } = {}

    try {
      if (selectedFile) {
        setIsUploading(true)
        const uploaded = await uploadChatAttachment(selectedFile)
        mediaPayload = {
          mediaUrl: uploaded.url,
          mediaKind: uploaded.mediaKind,
          mimeType: uploaded.mimeType,
        }
      }

      const message = await sendChatMessage(userId, {
        text,
        replyToMessageId,
        ...mediaPayload,
      })

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev
        return [
          ...prev,
          {
            ...message,
            type: message.type || mediaPayload.mediaKind || "text",
          },
        ]
      })

      setInputValue("")
      setReplyTo(null)
      clearAttachment()
    } catch (error: any) {
      if (text || mediaPayload.mediaUrl) {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            text,
            timestamp: new Date().toISOString(),
            fromMe: true,
            status: "sent",
            type: mediaPayload.mediaKind || "text",
            replyToMessageId,
            mediaUrl: mediaPayload.mediaUrl || null,
            mediaKind: mediaPayload.mediaKind || null,
            mimeType: mediaPayload.mimeType || null,
          },
        ])
      }
      setSendError(error?.message || "Failed to send message")
    } finally {
      setIsUploading(false)
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const getParentMessage = (messageId?: string | null) => {
    if (!messageId) return null
    return messages.find((m) => m.id === messageId) || null
  }

  const markMediaFailed = (url: string) => {
    setFailedMediaUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }))
  }

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null
    if (/^https?:\/\//i.test(url)) return url
    const apiBase = getApiBase()
    if (url.startsWith("/")) return apiBase ? `${apiBase}${url}` : url
    return apiBase ? `${apiBase}/${url}` : `/${url}`
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  const formatDate = (ts: string) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
  }

  const groupedMessages: { date: string; messages: DisplayMessage[] }[] = []
  let currentDate = ""

  messages.forEach((message) => {
    const dateKey = new Date(message.timestamp).toDateString()
    if (dateKey !== currentDate) {
      currentDate = dateKey
      groupedMessages.push({ date: message.timestamp, messages: [message] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => navigate("/chat")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <button
          onClick={() => navigate(`/profile/${user.username}`)}
          className="relative shrink-0 cursor-pointer border-none bg-transparent p-0"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="bg-accent/10 text-accent">
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />}
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            className="block cursor-pointer truncate border-none bg-transparent p-0 text-left font-medium text-card-foreground hover:underline"
          >
            {user.displayName}
          </button>
          <p className="text-xs text-muted-foreground">{user.isOnline ? "Online" : "Offline"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/profile/${user.username}`)}>View Profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "65vh" }} ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Avatar className="mb-3 h-16 w-16">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-accent/10 text-xl text-accent">
                {user.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="font-medium text-foreground">{user.displayName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Start a conversation</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedMessages.map((group) => (
              <div key={group.date} className="flex flex-col gap-1">
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">{formatDate(group.date)}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {group.messages.map((message) => {
                  const parent = getParentMessage(message.replyToMessageId)
                  const mediaSrc = resolveMediaUrl(message.mediaUrl)
                  const mediaUnavailable = !!(mediaSrc && failedMediaUrls[mediaSrc])
                  const messageType = message.type || message.mediaKind || "text"

                  return (
                    <div key={message.id} className={`group/msg flex items-end gap-1.5 ${message.fromMe ? "justify-end" : "justify-start"}`}>
                      {message.fromMe && messageType !== "capsule_share" && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(message)
                            inputRef.current?.focus()
                          }}
                          className="mb-1 shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-accent group-hover/msg:opacity-100"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {messageType === "capsule_share" ? (
                        <button
                          onClick={() => message.capsuleId && navigate(`/capsules/${message.capsuleId}`)}
                          className={`max-w-[72%] cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors ${message.fromMe ? "border-primary/30 bg-primary/10 hover:bg-primary/20" : "border-accent/30 bg-accent/10 hover:bg-accent/20"}`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Package className="h-4 w-4 text-accent" />
                            <span className="text-xs font-semibold text-accent">Shared Capsule</span>
                          </div>
                          <p className="text-sm font-medium text-card-foreground">{message.capsuleTitle || "Capsule"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Tap to view</p>
                          <p className={`mt-1 text-[10px] ${message.fromMe ? "text-primary/70" : "text-muted-foreground"}`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </button>
                      ) : (
                        <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${message.fromMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          {parent && (
                            <div className={`mb-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${message.fromMe ? "bg-white/15" : "bg-black/8"}`}>
                              <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                              <span className="line-clamp-2 opacity-80">{parent.text}</span>
                            </div>
                          )}

                          {messageType === "image" && mediaSrc && !mediaUnavailable && (
                            <img
                              src={mediaSrc}
                              alt="chat attachment"
                              className="mb-2 max-h-72 w-auto max-w-full rounded-xl object-contain"
                              onError={() => markMediaFailed(mediaSrc)}
                            />
                          )}
                          {messageType === "video" && mediaSrc && !mediaUnavailable && (
                            <video
                              src={mediaSrc}
                              controls
                              className="mb-2 max-h-80 w-full rounded-xl"
                              preload="metadata"
                              onError={() => markMediaFailed(mediaSrc)}
                            />
                          )}
                          {(messageType === "image" || messageType === "video") && (!mediaSrc || mediaUnavailable) && (
                            <p className="mb-2 text-xs opacity-80">Attachment is unavailable</p>
                          )}
                          {!!message.text?.trim() && (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                          )}
                          <p className={`mt-1 text-right text-[10px] ${message.fromMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      )}

                      {!message.fromMe && messageType !== "capsule_share" && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(message)
                            inputRef.current?.focus()
                          }}
                          className="mb-1 shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-accent group-hover/msg:opacity-100"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border bg-card p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleAttachmentPick}
        />

        {sendError && <p className="text-xs text-destructive">{sendError}</p>}

        {replyTo && (
          <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-semibold text-accent">Reply to</span>
              <span className="line-clamp-1 text-foreground/70">{replyTo.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {selectedFile && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2">
            {previewUrl && selectedFile.type.startsWith("image/") && (
              <img src={previewUrl} alt="attachment preview" className="h-12 w-12 rounded-md object-cover" />
            )}
            {previewUrl && selectedFile.type.startsWith("video/") && (
              <video src={previewUrl} className="h-12 w-12 rounded-md object-cover" muted />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">Attachment</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{selectedFile.name}</p>
            </div>
            <button type="button" onClick={clearAttachment} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isSending || isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={(!inputValue.trim() && !selectedFile) || isSending || isUploading}
          >
            {isSending || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
