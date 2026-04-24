import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Loader2, ArrowLeft, MoreVertical, Package, Reply, X, CornerDownRight, Paperclip } from "lucide-react"
import {
  getApiBase,
  getConversations,
  getChatMessages,
  getFollowing,
  getUserProfile,
  sendChatMessage,
  uploadChatAttachment,
  type ChatMessage,
} from "@/services/api"
import { setChatCallbacks, type ChatWsMessage } from "@/services/ws"
import {
  MEDIA_ACCEPT_ATTR,
  MEDIA_FILE_EXTENSIONS,
  MEDIA_MIME_TYPES,
  isSupportedImageMimeType,
  isSupportedMediaMimeType,
  isSupportedVideoMimeType,
  toPickerTypes,
  type MediaMimeType,
} from "@/lib/media-types"
import { openNativeFiles } from "@/lib/native-file-picker"
import { resolveAssetUrl } from "@/lib/asset-url"
import "./chat-window.css"

interface ChatWindowProps {
  userId: string
  currentUserId?: string
}

interface ChatUser {
  id: string
  username: string
  displayName: string
  avatar?: string
}

type DisplayMessage = ChatMessage

export function ChatWindow({ userId, currentUserId }: ChatWindowProps) {
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  const resolveChatUser = useCallback(async (): Promise<ChatUser> => {
    try {
      const conversations = await getConversations()
      const conversation = conversations.find((entry) => entry.user.id === userId)
      if (conversation?.user) {
        return {
          id: conversation.user.id,
          username: conversation.user.username || userId,
          displayName: conversation.user.displayName || conversation.user.username || userId,
          avatar: conversation.user.avatar,
        }
      }
    } catch {
      // ignore and try next source
    }

    if (currentUserId) {
      try {
        const following = await getFollowing(currentUserId)
        const entry = following.find((item) => item.id === userId)
        if (entry) {
          return {
            id: entry.id,
            username: entry.username || userId,
            displayName: entry.displayName || entry.username || userId,
            avatar: entry.avatar || entry.avatarUrl,
          }
        }
      } catch {
        // ignore and try next source
      }
    }

    try {
      const profile = await getUserProfile(userId)
      return {
        id: profile.id || userId,
        username: profile.username || userId,
        displayName: profile.displayName || profile.username || userId,
        avatar: profile.avatarUrl,
      }
    } catch {
      return { id: userId, username: userId, displayName: userId }
    }
  }, [userId, currentUserId])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setSendError(null)
    setUser(null)
    setMessages([])

    Promise.all([
      resolveChatUser(),
      getChatMessages(userId)
        .then((items) => items as DisplayMessage[])
        .catch(() => [] as DisplayMessage[]),
    ])
      .then(([chatUser, chatMessages]) => {
        if (!active) return
        setUser(chatUser)
        setMessages(chatMessages)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, resolveChatUser])

  const handleWsMessage = useCallback(
    (msg: ChatWsMessage) => {
      if (msg.type === "presence") return
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
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

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

  const setAttachmentFile = (file: File): void => {
    if (!isSupportedMediaMimeType(file.type)) {
      setSendError(`Unsupported file type. Allowed formats: ${MEDIA_FILE_EXTENSIONS.join(", ")}`)
      return
    }
    setSendError(null)
    setSelectedFile(file)
  }

  const handleAttachmentPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentFile(file)
    e.target.value = ""
  }

  const openAttachmentPicker = async () => {
    const selectedFiles = await openNativeFiles({
      multiple: false,
      types: toPickerTypes(MEDIA_MIME_TYPES),
      excludeAcceptAllOption: false,
    })
    if (selectedFiles === null) {
      fileInputRef.current?.click()
      return
    }
    if (selectedFiles[0]) setAttachmentFile(selectedFiles[0])
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
      mimeType?: MediaMimeType | null
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

  const getReplyPreviewText = (message?: DisplayMessage | null) => {
    if (!message) return ""
    const type = message.type || message.mediaKind || "text"
    const cleanText = message.text?.trim()

    if (cleanText) return cleanText
    if (type === "image") return "Photo attachment"
    if (type === "video") return "Video attachment"
    if (type === "capsule_share") return message.capsuleTitle ? `Capsule: ${message.capsuleTitle}` : "Shared capsule"
    return "Message"
  }

  const scrollToMessage = useCallback((messageId?: string | null) => {
    if (!messageId) return
    const target = messageRefs.current[messageId]
    if (!target) return

    target.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlightedMessageId(messageId)

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current))
    }, 1800)
  }, [])

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
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#15305e]/34">
      <div className="flex items-center gap-3 border-b border-cyan-200/10 bg-[#17335f]/42 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 rounded-lg border border-cyan-200/12 bg-white/[0.06] px-2.5 text-slate-200 hover:bg-white/[0.12] hover:text-white"
          onClick={() => navigate("/chat")}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">Chats</span>
        </Button>
        <button
          onClick={() => navigate(`/profile/${user.username}`)}
          className="relative shrink-0 cursor-pointer border-none bg-transparent p-0"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={resolveAssetUrl(user.avatar)} />
          <AvatarFallback className="bg-violet-400/18 text-cyan-100">
              {user.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            className="block cursor-pointer truncate border-none bg-transparent p-0 text-left font-medium text-slate-100 hover:underline"
          >
            {user.displayName}
          </button>
          <p className="text-xs text-slate-400">@{user.username}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/10 hover:text-white">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/profile/${user.username}`)}>View Profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Avatar className="mb-3 h-16 w-16">
              <AvatarImage src={resolveAssetUrl(user.avatar)} />
              <AvatarFallback className="bg-violet-400/18 text-xl text-cyan-100">
                {user.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="font-medium text-slate-100">{user.displayName}</p>
            <p className="mt-1 text-sm text-slate-400">Start a conversation</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedMessages.map((group) => (
              <div key={group.date} className="flex flex-col gap-1">
                <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-cyan-200/10" />
                  <span className="text-xs text-slate-400">{formatDate(group.date)}</span>
                    <div className="h-px flex-1 bg-cyan-200/10" />
                </div>

                {group.messages.map((message) => {
                  const parent = getParentMessage(message.replyToMessageId)
                  const mediaSrc = resolveMediaUrl(message.mediaUrl)
                  const mediaUnavailable = !!(mediaSrc && failedMediaUrls[mediaSrc])
                  const messageType = message.type || message.mediaKind || "text"

                  return (
                    <div
                      key={message.id}
                      ref={(el) => { messageRefs.current[message.id] = el }}
                      className={`group/msg flex items-end gap-1.5 ${message.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      {message.fromMe && messageType !== "capsule_share" && (
                          <button
                            type="button"
                          onClick={() => {
                            setReplyTo(message)
                            inputRef.current?.focus()
                          }}
                            className="mb-1 shrink-0 rounded-full p-1.5 text-slate-500 opacity-0 transition-all hover:bg-white/10 hover:text-cyan-100 group-hover/msg:opacity-100"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {messageType === "capsule_share" ? (
                        <button
                          onClick={() => message.capsuleId && navigate(`/capsules/${message.capsuleId}`)}
                          className={`max-w-[80%] cursor-pointer rounded-lg border px-4 py-3 text-left transition-[background-color,transform] duration-300 ${message.fromMe ? "border-cyan-200/18 bg-[#1d4f7c]/82 hover:bg-[#225985]/86" : "border-cyan-300/28 bg-cyan-300/10 hover:bg-cyan-300/14"} ${highlightedMessageId === message.id ? "message-jump-highlight ring-1 ring-cyan-300/45" : ""}`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Package className="h-4 w-4 text-cyan-200" />
                            <span className="text-xs font-semibold text-cyan-100">Shared Capsule</span>
                          </div>
                          <p className="text-sm font-medium text-slate-100">{message.capsuleTitle || "Capsule"}</p>
                          <p className="mt-1 text-xs text-slate-300">Tap to view</p>
                          <p className={`mt-1 text-[10px] ${message.fromMe ? "text-slate-200/75" : "text-slate-300/75"}`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </button>
                      ) : (
                        <div className={`max-w-[80%] rounded-lg border px-4 py-2.5 transition-transform duration-300 ${message.fromMe ? "border-cyan-200/18 bg-[#1d4f7c]/82 text-slate-50" : "border-cyan-200/12 bg-[#17335f]/62 text-slate-100"} ${highlightedMessageId === message.id ? "message-jump-highlight ring-1 ring-cyan-300/45" : ""}`}>
                          {parent && (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(parent.id)}
                              className={`mb-2 flex w-full items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${message.fromMe ? "bg-white/16 hover:bg-white/24" : "bg-[#0d1935]/56 hover:bg-[#0d1935]/76"}`}
                            >
                              <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                              <span className="line-clamp-2 break-words [overflow-wrap:anywhere] opacity-80">{getReplyPreviewText(parent)}</span>
                            </button>
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
                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">{message.text}</p>
                          )}
                          <p className={`mt-1 text-right text-[10px] ${message.fromMe ? "text-slate-50/65" : "text-slate-400"}`}>
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
                          className="mb-1 shrink-0 rounded-full p-1.5 text-slate-500 opacity-0 transition-all hover:bg-white/10 hover:text-cyan-100 group-hover/msg:opacity-100"
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-cyan-200/10 bg-[#17335f]/46 p-3 sm:p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT_ATTR}
          className="hidden"
          onChange={handleAttachmentPick}
        />

        {sendError && <p className="text-xs text-rose-300">{sendError}</p>}

        {replyTo && (
          <div className="flex items-center justify-between rounded-lg bg-cyan-300/10 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => scrollToMessage(replyTo.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
              <span className="font-semibold text-cyan-100">Reply to</span>
              <span className="line-clamp-1 break-words [overflow-wrap:anywhere] text-slate-200/80">{getReplyPreviewText(replyTo)}</span>
            </button>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 shrink-0 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {selectedFile && (
          <div className="flex items-start gap-2 rounded-lg border border-cyan-200/10 bg-white/[0.08] px-3 py-2">
            {previewUrl && isSupportedImageMimeType(selectedFile.type) && (
              <img src={previewUrl} alt="attachment preview" className="h-12 w-12 rounded-md object-cover" />
            )}
            {previewUrl && isSupportedVideoMimeType(selectedFile.type) && (
              <video src={previewUrl} className="h-12 w-12 rounded-md object-cover" muted />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-100">Attachment</p>
              <p className="line-clamp-1 text-xs text-slate-400">{selectedFile.name}</p>
            </div>
            <button type="button" onClick={clearAttachment} className="shrink-0 text-slate-400 hover:text-slate-100">
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
            className="flex-1 rounded-xl border border-cyan-200/12 bg-white/[0.08] text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-200/40 focus-visible:ring-1 focus-visible:ring-cyan-200/35"
            disabled={isSending || isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => { void openAttachmentPicker() }}
            disabled={isSending || isUploading}
            className="rounded-xl border-cyan-200/12 bg-white/[0.08] text-slate-200 hover:bg-white/[0.14] hover:text-white"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={(!inputValue.trim() && !selectedFile) || isSending || isUploading}
            className="rounded-xl border border-cyan-200/18 bg-[linear-gradient(160deg,rgba(72,201,255,0.95)_0%,rgba(99,157,255,0.92)_100%)] text-slate-950 shadow-[0_10px_24px_rgba(70,184,255,0.22)] hover:brightness-105"
          >
            {isSending || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
