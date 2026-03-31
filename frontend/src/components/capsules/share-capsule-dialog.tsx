import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Share2, Search, Check, Loader2, Send } from "lucide-react"
import { type UserData } from "@/components/users/user-card"
import { shareCapsule } from "@/services/api"

interface ShareCapsuleDialogProps {
  capsuleId: string
  capsuleTitle: string
  following: UserData[]
}

export function ShareCapsuleDialog({
  capsuleId,
  capsuleTitle,
  following,
  open,
  onOpenChange,
}: ShareCapsuleDialogProps & { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open! : internalOpen
  const setDialogOpen = onOpenChange ?? setInternalOpen
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const filteredUsers = following.filter((user) => user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || user.username.toLowerCase().includes(searchQuery.toLowerCase()))
  const toggleUser = (userId: string) => setSelectedUsers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId])

  const handleShare = async () => {
    if (selectedUsers.length === 0) return
    setIsSending(true)
    try { await shareCapsule(capsuleId, selectedUsers) } catch { /* ignore */ }
    setIsSending(false); setSent(true)
    setTimeout(() => { setDialogOpen(false); setSent(false); setSelectedUsers([]); setSearchQuery("") }, 1500)
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-md border border-white/14 bg-[#071022]/96 text-slate-100 backdrop-blur-2xl shadow-[0_28px_80px_rgba(2,6,23,0.68)]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-slate-50">Share Capsule</DialogTitle>
          <DialogDescription className="truncate text-slate-300">
            Share "{capsuleTitle}" with your followers
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/16">
              <Check className="h-6 w-6 text-emerald-200" />
            </div>
            <p className="font-medium text-slate-100">Shared successfully!</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search followers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 border-white/14 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-300/55 focus-visible:ring-cyan-300/45"
              />
            </div>
            <ScrollArea className="h-[240px] pr-4">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-slate-400">
                    {searchQuery ? "No followers found" : "You don't follow anyone yet to share with."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.id)
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                          isSelected
                            ? "border-cyan-300/55 bg-cyan-400/20 shadow-[0_0_0_1px_rgba(34,211,238,0.34)]"
                            : "border-transparent bg-transparent hover:border-white/12 hover:bg-white/[0.05]"
                        }`}
                      >
                        <Avatar className="h-9 w-9 border border-white/12">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="bg-[#12213f] text-slate-200">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium text-slate-100">{user.displayName}</p>
                          <p className="truncate text-xs text-slate-400">@{user.username}</p>
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-cyan-300/70 bg-cyan-400 text-[#052436]"
                              : "border-white/18 text-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <p className="text-sm text-slate-300">{selectedUsers.length} selected</p>
              <Button
                onClick={handleShare}
                disabled={selectedUsers.length === 0 || isSending}
                className="gap-1.5 border border-violet-300/30 bg-violet-500/90 text-slate-50 hover:bg-violet-500"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Share
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
