import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertBanner } from "@/components/alert-banner"
import { MediaUploader, type MediaFile } from "@/components/media/media-uploader"
import { Loader2, Lock, Globe, Link2, X, ArrowLeft } from "lucide-react"
import type { CreateCapsulePayload, ApiError } from "@/services/api"

interface CreateCapsuleFormProps {
  onSubmit: (data: CreateCapsulePayload) => Promise<void>
  onCancel?: () => void
  error: ApiError | null
}

export function CreateCapsuleForm({ onSubmit, onCancel, error: parentError }: CreateCapsuleFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [visibility, setVisibility] = useState("private")
  const [status, setStatus] = useState("sealed")
  const [allowComments, setAllowComments] = useState(true)
  const [allowReactions, setAllowReactions] = useState(true)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const navigate = useNavigate()

  const error = parentError || localError

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 1)
  const maxDate = new Date('2100-12-31T23:59')
  const minDateString = minDate.toISOString().slice(0, 16)
  const maxDateString = maxDate.toISOString().slice(0, 16)

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,/g, "")
      if (tag && !tags.includes(tag)) setTags([...tags, tag])
      setTagInput("")
    }
  }

  function removeTag(t: string) { setTags(tags.filter((x) => x !== t)) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    const fd = new FormData(e.currentTarget)
    const title = fd.get("title")?.toString().trim() || ""
    const body = fd.get("body")?.toString().trim() || ""
    const unlockAt = fd.get("unlockAt")?.toString() || ""
    const expiresAt = fd.get("expiresAt")?.toString() || ""

    if (!title) { setLocalError({ status: 0, message: "Title is required" }); return }
    if (!unlockAt) { setLocalError({ status: 0, message: "Unlock date is required" }); return }

    const unlockDate = new Date(unlockAt)
    const now = new Date()

    if (unlockDate <= now) { setLocalError({ status: 0, message: "Unlock date must be in the future" }); return }
    if (unlockDate.getFullYear() > 2100) { setLocalError({ status: 0, message: "Unlock year cannot exceed 2100" }); return }
    if (unlockDate.getFullYear() < now.getFullYear()) { setLocalError({ status: 0, message: "Invalid unlock date" }); return }

    if (expiresAt) {
      const expiresDate = new Date(expiresAt)
      if (expiresDate.getFullYear() > 2100) { setLocalError({ status: 0, message: "Expiry year cannot exceed 2100" }); return }
      if (expiresDate <= unlockDate) { setLocalError({ status: 0, message: "Expiry date must be after unlock date" }); return }
    }

    setIsLoading(true)
    try {
      await onSubmit({
        title,
        body: body || null,
        visibility,
        status,
        unlockAt: new Date(unlockAt).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        allowComments,
        allowReactions,
        tags: tags.length > 0 ? tags : null,
        media: null,
        location: null,
      })
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-1.5 text-muted-foreground -ml-3"><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold tracking-tight text-card-foreground">Create Time Capsule</h1>
        <p className="mb-6 text-sm text-muted-foreground">Fill in the details below to create your capsule.</p>

        {error && <AlertBanner type="error" message={error.message || 'Failed to create capsule'} onDismiss={() => setLocalError(null)} />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
            <Input id="title" name="title" type="text" placeholder="Give your capsule a name..." className="h-11" maxLength={200} required />
            <p className="text-xs text-muted-foreground">Max 200 characters</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body" className="text-sm font-medium">Message</Label>
            <Textarea id="body" name="body" placeholder="Write your message to the future..." className="min-h-[140px] resize-y" maxLength={5000} />
            <p className="text-xs text-muted-foreground">Optional. Max 5000 characters</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Visibility <span className="text-destructive">*</span></Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select visibility" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private"><span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" />Private</span></SelectItem>
                  <SelectItem value="public"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Public</span></SelectItem>
                  <SelectItem value="shared"><span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />Shared</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Status <span className="text-destructive">*</span></Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sealed">Sealed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="unlockAt" className="text-sm font-medium">Unlock Date <span className="text-destructive">*</span></Label>
              <Input id="unlockAt" name="unlockAt" type="datetime-local" className="h-11" min={minDateString} max={maxDateString} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiresAt" className="text-sm font-medium">Expires Date</Label>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" className="h-11" min={minDateString} max={maxDateString} />
              <p className="text-xs text-muted-foreground">Optional</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Media</Label>
            <MediaUploader files={mediaFiles} onFilesChange={setMediaFiles} />
            <p className="text-xs text-muted-foreground">Optional. Add photos or videos to your capsule.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags" className="text-sm font-medium">Tags</Label>
            <Input id="tags" type="text" placeholder="Type a tag and press Enter" className="h-11" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted bg-transparent border-none shadow-none"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-foreground">Allow Comments</p><p className="text-xs text-muted-foreground">Let others comment on your capsule</p></div>
              <Switch checked={allowComments} onCheckedChange={setAllowComments} />
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-foreground">Allow Reactions</p><p className="text-xs text-muted-foreground">Let others react to your capsule</p></div>
              <Switch checked={allowReactions} onCheckedChange={setAllowReactions} />
            </div>
          </div>

          <Button type="submit" className="h-12 w-full text-sm font-semibold" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating capsule...</> : "Create Capsule"}
          </Button>
        </form>
      </div>
    </div>
  )
}

