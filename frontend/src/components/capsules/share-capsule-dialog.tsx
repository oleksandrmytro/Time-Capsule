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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Capsule</DialogTitle>
          <DialogDescription className="truncate">Share "{capsuleTitle}" with your followers</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><Check className="h-6 w-6 text-success" /></div>
            <p className="font-medium text-foreground">Shared successfully!</p>
          </div>
        ) : (
          <>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search followers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
            <ScrollArea className="h-[240px] pr-4">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center"><p className="text-sm text-muted-foreground">{searchQuery ? "No followers found" : "У списку підписок нікого немає."}</p></div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.id)
                    return (
                      <button key={user.id} onClick={() => toggleUser(user.id)} className={`flex items-center gap-3 rounded-lg p-2 transition-colors w-full bg-transparent border-none text-left cursor-pointer ${isSelected ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-muted"}`}>
                        <Avatar className="h-9 w-9"><AvatarImage src={user.avatar} /><AvatarFallback className="bg-secondary text-secondary-foreground">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium text-foreground">{user.displayName}</p><p className="truncate text-xs text-muted-foreground">@{user.username}</p></div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? "border-accent bg-accent text-white" : "border-border"}`}>{isSelected && <Check className="h-3 w-3" />}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{selectedUsers.length} selected</p>
              <Button onClick={handleShare} disabled={selectedUsers.length === 0 || isSending} className="gap-1.5">{isSending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</> : <><Send className="h-4 w-4" />Share</>}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
