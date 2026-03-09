import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageCircle, Send, Trash2, Pencil, MoreVertical, Loader2, X, Reply, CornerDownRight } from "lucide-react"
import { getComments, addComment, deleteComment, updateComment, type CommentData } from "@/services/api"

interface CommentsSectionProps {
  capsuleId: string
  isAuthenticated: boolean
  currentUserId?: string
}

export function CommentsSection({ capsuleId, isAuthenticated, currentUserId }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [body, setBody] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    getComments(capsuleId).then(setComments).catch(() => {}).finally(() => setLoading(false))
  }, [capsuleId])

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const newComment = await addComment(capsuleId, trimmed)
      setComments(prev => [newComment, ...prev])
      setBody("")
      setIsFocused(false)
    } catch {}
    setSubmitting(false)
  }

  const handleReplySubmit = async () => {
    if (!replyingTo) return
    const trimmed = replyBody.trim()
    if (!trimmed || replySubmitting) return
    setReplySubmitting(true)
    try {
      const newReply = await addComment(capsuleId, trimmed, replyingTo.id)
      setComments(prev => [newReply, ...prev])
      setReplyBody("")
      setReplyingTo(null)
    } catch {}
    setReplySubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      await deleteComment(capsuleId, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
    setDeletingId(null)
  }

  const handleStartEdit = (comment: CommentData) => {
    setEditingId(comment.id)
    setEditBody(comment.body)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditBody("")
  }

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editBody.trim()
    if (!trimmed || editSubmitting) return
    setEditSubmitting(true)
    try {
      const updated = await updateComment(capsuleId, commentId, trimmed)
      setComments(prev => prev.map(c => c.id === commentId ? updated : c))
      setEditingId(null)
      setEditBody("")
    } catch {}
    setEditSubmitting(false)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSec < 60) return "just now"
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getParentComment = (parentId?: string | null) => {
    if (!parentId) return null
    return comments.find(c => c.id === parentId) || null
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Заголовок секції */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/10">
          <MessageCircle className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-card-foreground">Comments</h2>
          <p className="text-sm text-muted-foreground">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </p>
        </div>
      </div>

      {/* Форма додавання коментаря */}
      {isAuthenticated ? (
        <div
          className={`flex flex-col gap-3 rounded-xl border transition-all duration-200 ${
            isFocused ? "border-accent bg-card shadow-lg shadow-accent/10" : "border-border bg-card shadow-sm"
          } p-4 sm:p-5`}
        >
          {replyingTo && (
            <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <CornerDownRight className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="font-semibold text-accent">Replying to {replyingTo.username}</span>
                <span className="line-clamp-1 text-foreground/70">{replyingTo.body}</span>
              </div>
              <button type="button" onClick={() => { setReplyingTo(null); setReplyBody("") }} className="text-muted-foreground hover:text-foreground shrink-0 ml-2"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <Textarea
                value={replyingTo ? replyBody : body}
                onChange={(e) => replyingTo ? setReplyBody(e.target.value) : setBody(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !body.trim() && !replyingTo && setIsFocused(false)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    replyingTo ? handleReplySubmit() : handleSubmit()
                  }
                }}
                placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Share your thoughts about this capsule..."}
                disabled={submitting || replySubmitting}
                className="min-h-12 resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 sm:text-base"
                maxLength={2000}
                rows={1}
              />
            </div>
          </div>
          {(isFocused || body.trim() || replyingTo) && (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBody(""); setIsFocused(false); setReplyingTo(null); setReplyBody("") }} disabled={submitting || replySubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={replyingTo ? (!replyBody.trim() || replySubmitting) : (!body.trim() || submitting)}
                onClick={replyingTo ? handleReplySubmit : handleSubmit}
              >
                {(submitting || replySubmitting) ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span>Posting...</span></>
                ) : (
                  <><Send className="h-4 w-4" /><span className="hidden sm:inline">{replyingTo ? "Reply" : "Post"}</span></>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Увійдіть, щоб залишити коментар.</p>
      )}

      {/* Список коментарів */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col max-h-[50vh] overflow-y-auto pr-1">
          {comments.map((comment, idx) => {
            const isOwn = currentUserId === comment.userId
            const isEditing = editingId === comment.id
            const parent = getParentComment(comment.parentCommentId)

            return (
              <div key={comment.id}>
                <div className="group flex gap-3 sm:gap-4 rounded-lg p-3 sm:p-4 transition-all duration-200 hover:bg-muted/30">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={comment.avatarUrl} alt={comment.username} />
                    <AvatarFallback className="bg-accent/10 text-accent font-bold text-xs">
                      {(comment.username || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-card-foreground line-clamp-1">
                          {comment.username || "User"}
                        </span>
                        <p className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</p>
                      </div>

                      {isOwn && !isEditing && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(comment.id)} disabled={deletingId === comment.id} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                              {deletingId === comment.id ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4 mr-2" />Delete</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {parent && (
                      <div className="mb-2 flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <CornerDownRight className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground/70">@{parent.username}</span>
                        <span className="line-clamp-1">{parent.body}</span>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[60px] resize-none text-sm" maxLength={2000} autoFocus />
                        <div className="flex items-center gap-2 justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} disabled={editSubmitting}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                          <Button type="button" size="sm" className="gap-1.5" disabled={!editBody.trim() || editSubmitting} onClick={() => handleSaveEdit(comment.id)}>
                            {editSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed text-card-foreground break-words whitespace-pre-wrap">{comment.body}</p>
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={() => { setReplyingTo(comment); setReplyBody(""); setIsFocused(true) }}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Reply className="h-3.5 w-3.5" /> Reply
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {idx < comments.length - 1 && <Separator />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
