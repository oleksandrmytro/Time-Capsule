import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageCircle,
  Send,
  Trash2,
  Pencil,
  MoreVertical,
  Loader2,
  X,
  Reply,
  CornerDownRight,
} from "lucide-react"
import { getComments, addComment, deleteComment, updateComment, type CommentData } from "@/services/api"
import { resolveAssetUrl } from "@/lib/asset-url"

interface CommentsSectionProps {
  capsuleId: string
  isAuthenticated: boolean
  currentUserId?: string
  capsuleOwnerId?: string | null
  capsuleOwnerName?: string | null
}

export function CommentsSection({
  capsuleId,
  isAuthenticated,
  currentUserId,
  capsuleOwnerId,
  capsuleOwnerName,
}: CommentsSectionProps) {
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
    getComments(capsuleId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [capsuleId])

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const newComment = await addComment(capsuleId, trimmed)
      setComments((previous) => [newComment, ...previous])
      setBody("")
      setIsFocused(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplySubmit = async () => {
    if (!replyingTo) return
    const trimmed = replyBody.trim()
    if (!trimmed || replySubmitting) return
    setReplySubmitting(true)
    try {
      const newReply = await addComment(capsuleId, trimmed, replyingTo.id)
      setComments((previous) => [newReply, ...previous])
      setReplyBody("")
      setReplyingTo(null)
    } catch {
      // ignore
    } finally {
      setReplySubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      await deleteComment(capsuleId, commentId)
      setComments((previous) => previous.filter((comment) => comment.id !== commentId))
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
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
      setComments((previous) => previous.map((comment) => (comment.id === commentId ? updated : comment)))
      setEditingId(null)
      setEditBody("")
    } catch {
      // ignore
    } finally {
      setEditSubmitting(false)
    }
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
    return comments.find((comment) => comment.id === parentId) || null
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-slate-900/48 p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/24 bg-cyan-300/12">
          <MessageCircle className="h-5 w-5 text-cyan-100" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-100">Comments</h2>
          <p className="text-xs text-slate-400">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </p>
        </div>
      </div>

      {isAuthenticated ? (
        <div className="space-y-3">
          {replyingTo && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-violet-300/26 bg-violet-400/12 px-3 py-2 text-xs text-slate-200">
              <div className="flex min-w-0 items-center gap-2">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-violet-100" />
                <span className="shrink-0 font-semibold text-violet-100">Replying to {replyingTo.username}</span>
                <span className="line-clamp-1 text-slate-300">{replyingTo.body}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(null)
                  setReplyBody("")
                }}
                className="ml-2 shrink-0 text-slate-300 transition-colors hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Textarea
            value={replyingTo ? replyBody : body}
            onChange={(event) => (replyingTo ? setReplyBody(event.target.value) : setBody(event.target.value))}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!(replyingTo ? replyBody : body).trim() && !replyingTo) setIsFocused(false)
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                replyingTo ? handleReplySubmit() : handleSubmit()
              }
            }}
            placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Write a comment..."}
            disabled={submitting || replySubmitting}
            className={`min-h-[96px] resize-y rounded-xl border text-sm text-slate-100 placeholder:text-slate-400 transition-all ${
              isFocused || body.trim() || replyingTo
                ? "border-violet-300/50 bg-[#071024]/90 shadow-[0_0_24px_rgba(124,92,255,0.14)] focus-visible:border-violet-300/60 focus-visible:ring-violet-300/48"
                : "border-white/12 bg-[#060d1f]/82 focus-visible:border-violet-300/52 focus-visible:ring-violet-300/45"
            }`}
            maxLength={2000}
          />

          {(isFocused || body.trim() || replyingTo) && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {(replyingTo ? replyBody : body).length}/2000
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-300 hover:bg-white/[0.07] hover:text-slate-100"
                  onClick={() => {
                    setBody("")
                    setReplyBody("")
                    setReplyingTo(null)
                    setIsFocused(false)
                  }}
                  disabled={submitting || replySubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 border border-violet-300/28 bg-violet-500/85 text-slate-50 hover:bg-violet-500"
                  disabled={
                    replyingTo
                      ? !replyBody.trim() || replySubmitting
                      : !body.trim() || submitting
                  }
                  onClick={replyingTo ? handleReplySubmit : handleSubmit}
                >
                  {submitting || replySubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> {replyingTo ? "Reply" : "Post"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
          Sign in to leave a comment.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="mt-4 max-h-[54vh] space-y-3 overflow-y-auto pr-1">
          {comments.map((comment) => {
            const isOwn = currentUserId === comment.userId
            const isEditing = editingId === comment.id
            const parent = getParentComment(comment.parentCommentId)
            const isCapsuleOwner = !!capsuleOwnerId && comment.userId === capsuleOwnerId

            return (
              <div
                key={comment.id}
                className="group rounded-xl border border-white/10 bg-[#060d1f]/78 p-3 transition-colors hover:bg-[#091229]/86 sm:p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/12">
                    <AvatarImage src={resolveAssetUrl(comment.avatarUrl)} alt={comment.username} />
                    <AvatarFallback className="bg-cyan-300/16 text-xs font-bold text-cyan-100">
                      {(comment.username || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{comment.username || "User"}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <p className="text-xs text-slate-400">{formatTime(comment.createdAt)}</p>
                          {isCapsuleOwner ? (
                            <span
                              title={capsuleOwnerName ? `Capsule owner: ${capsuleOwnerName}` : "Capsule owner"}
                              className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-300/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100"
                            >
                              Owner
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {isOwn && !isEditing && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-slate-100 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/14 bg-[#091126]/95 text-slate-100">
                            <DropdownMenuItem
                              onClick={() => handleStartEdit(comment)}
                              className="cursor-pointer focus:bg-violet-500/18 focus:text-slate-100"
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(comment.id)}
                              disabled={deletingId === comment.id}
                              className="cursor-pointer text-rose-200 focus:bg-rose-500/16 focus:text-rose-100"
                            >
                              {deletingId === comment.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {parent && (
                      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300">
                        <CornerDownRight className="h-3 w-3 shrink-0 text-cyan-200" />
                        <span className="font-medium text-cyan-100">@{parent.username}</span>
                        <span className="line-clamp-1">{parent.body}</span>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editBody}
                          onChange={(event) => setEditBody(event.target.value)}
                          className="min-h-[90px] resize-y border-white/10 bg-white/[0.03] text-sm text-slate-100 focus-visible:border-violet-300/55 focus-visible:ring-violet-300/45"
                          maxLength={2000}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-300 hover:bg-white/[0.07] hover:text-slate-100"
                            onClick={handleCancelEdit}
                            disabled={editSubmitting}
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5 border border-violet-300/28 bg-violet-500/85 text-slate-50 hover:bg-violet-500"
                            disabled={!editBody.trim() || editSubmitting}
                            onClick={() => handleSaveEdit(comment.id)}
                          >
                            {editSubmitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="break-words whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0b152d]/72 px-3 py-2 text-sm leading-relaxed text-slate-100">
                          {comment.body}
                        </p>
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(comment)
                              setReplyBody("")
                              setIsFocused(true)
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-cyan-200"
                          >
                            <Reply className="h-3.5 w-3.5" /> Reply
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
