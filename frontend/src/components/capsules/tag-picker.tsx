import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X, Plus, Search, Check, Tag as TagIcon, Loader2, Image as ImageIcon } from "lucide-react"
import { listTags, createTag, type Tag } from "@/services/api"
import { IMAGE_ACCEPT_ATTR } from "@/lib/media-types"
import { resolveTagImageUrl } from "@/lib/tag-image-url"

interface TagPickerProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onCoverSuggestion?: (url: string) => void
  theme?: "default" | "cosmic"
}

const CUSTOM_TAG_TYPE_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "memory", label: "Memory" },
  { value: "travel", label: "Travel" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "event", label: "Event" },
  { value: "milestone", label: "Milestone" },
  { value: "work", label: "Work" },
  { value: "study", label: "Study" },
  { value: "nature", label: "Nature" },
]

export function TagPicker({ selectedTags, onTagsChange, onCoverSuggestion, theme = "default" }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [customTagName, setCustomTagName] = useState("")
  const [customTagType, setCustomTagType] = useState<string>("custom")
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [customTagFile, setCustomTagFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    setLoading(true)
    try {
      const tags = await listTags()
      setAllTags(tags)
    } catch {
      setAllTags([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTags = allTags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const isCosmic = theme === "cosmic"
  const labelClass = isCosmic ? "text-sm font-medium flex items-center gap-1.5 text-slate-200" : "text-sm font-medium flex items-center gap-1.5"
  const actionBtnClass = isCosmic
    ? "h-7 gap-1 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
    : "h-7 gap-1 text-xs"
  const createWrapClass = isCosmic
    ? "flex flex-col gap-2 rounded-lg border border-white/12 bg-white/[0.03] p-3"
    : "flex flex-col gap-2 rounded-lg border border-border p-3"
  const inputClass = isCosmic
    ? "h-9 text-sm border-white/12 bg-white/[0.04] text-slate-100 placeholder:text-slate-400 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
    : "h-9 text-sm"
  const fileInputClass = isCosmic
    ? "h-9 text-xs border-white/12 bg-white/[0.04] text-slate-100 file:text-slate-100"
    : "h-9 text-xs"
  const selectClass = isCosmic
    ? "h-9 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-slate-100 focus-visible:border-violet-300/55 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/60"
    : "h-9 rounded-md border border-input bg-background px-3 text-sm"
  const fileLabelClass = isCosmic
    ? "text-xs text-slate-300 flex items-center gap-1"
    : "text-xs text-muted-foreground flex items-center gap-1"
  const previewChipClass = isCosmic
    ? "inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1"
    : "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
  const previewTextClass = isCosmic ? "flex items-center gap-2 text-xs text-slate-300" : "flex items-center gap-2 text-xs text-muted-foreground"
  const searchIconClass = isCosmic ? "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" : "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
  const searchClass = isCosmic
    ? "h-9 pl-9 text-sm border-white/12 bg-white/[0.04] text-slate-100 placeholder:text-slate-400 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
    : "h-9 pl-9 text-sm"
  const selectedTagClass = isCosmic
    ? "inline-flex items-center gap-1 rounded-full border border-cyan-300/28 bg-cyan-300/10 px-2.5 py-1 text-xs font-medium text-cyan-100"
    : "inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent-foreground"
  const tagButtonBaseClass = isCosmic
    ? "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all cursor-pointer bg-white/[0.02] shadow-none"
    : "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all cursor-pointer bg-transparent shadow-none"
  const tagButtonSelectedClass = isCosmic
    ? "border-cyan-300/35 bg-cyan-300/12 ring-1 ring-cyan-300/28"
    : "border-accent bg-accent/10 ring-1 ring-accent/30"
  const tagButtonIdleClass = isCosmic
    ? "border-white/12 hover:border-cyan-300/35 hover:bg-white/[0.06]"
    : "border-border hover:border-accent/40 hover:bg-muted/50"
  const tagFallbackClass = isCosmic
    ? (isSelected: boolean) => `flex h-12 w-full items-center justify-center rounded-lg ${isSelected ? "bg-cyan-300/14" : "bg-white/[0.04]"}`
    : (isSelected: boolean) => `flex h-12 w-full items-center justify-center rounded-lg ${isSelected ? "bg-accent/20" : "bg-muted"}`
  const tagFallbackIconClass = isCosmic
    ? (isSelected: boolean) => `h-4 w-4 ${isSelected ? "text-cyan-100" : "text-slate-400"}`
    : (isSelected: boolean) => `h-4 w-4 ${isSelected ? "text-accent" : "text-muted-foreground"}`
  const tagNameClass = isCosmic
    ? (isSelected: boolean) => `text-[11px] font-medium leading-tight ${isSelected ? "text-cyan-100" : "text-slate-300"}`
    : (isSelected: boolean) => `text-[11px] font-medium leading-tight ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`
  const emptyStateClass = isCosmic ? "text-center text-xs text-slate-400 py-3" : "text-center text-xs text-muted-foreground py-3"

  const resolveUrl = (url?: string | null) => {
    if (!url) return undefined
    // Keep relative URLs as-is — nginx will proxy /static/tags/* to backend
    return url
  }

  const resolveTagImage = (tag: Tag) => {
    return resolveTagImageUrl(tag.imageUrl, !!tag.isSystem)
  }

  const toggleTag = useCallback((tagName: string, imageUrl?: string | null) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName))
    } else {
      onTagsChange([...selectedTags, tagName])
      if (imageUrl && onCoverSuggestion) {
        onCoverSuggestion(imageUrl)
      }
    }
  }, [selectedTags, onTagsChange, onCoverSuggestion])

  const handleCreateTag = async () => {
    const selectedPreset = CUSTOM_TAG_TYPE_OPTIONS.find((option) => option.value === customTagType)
    const presetName = customTagType !== "custom" ? (selectedPreset?.label || "") : ""
    const name = customTagName.trim() || presetName
    if (!name) return
    setCreating(true)
    try {
      const tag = await createTag(name, customTagFile)
      setAllTags(prev => [...prev, tag])
      onTagsChange([...selectedTags, tag.name]) // Add new tag to selection

      // Validate tag structure
      const safeImage = resolveTagImage(tag)
      if (safeImage && onCoverSuggestion) {
         onCoverSuggestion(safeImage)
      }

      setCustomTagName("")
      setCustomTagType("custom")
      setCustomTagFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setShowCreateInput(false)
    } catch {
      // tag might already exist
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className={labelClass}>
          <TagIcon className="h-4 w-4" /> Tags
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={actionBtnClass}
          onClick={() => setShowCreateInput(!showCreateInput)}
        >
          <Plus className="h-3 w-3" /> Custom Tag
        </Button>
      </div>

      {showCreateInput && (
        <div className={createWrapClass}>
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={customTagType}
              onChange={(e) => setCustomTagType(e.target.value)}
              className={selectClass}
            >
              {CUSTOM_TAG_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Input
              placeholder={customTagType === "custom" ? "New tag name..." : `Name (default: ${CUSTOM_TAG_TYPE_OPTIONS.find((option) => option.value === customTagType)?.label || "Custom"})`}
              className={inputClass}
              value={customTagName}
              onChange={e => setCustomTagName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag() } }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={handleCreateTag}
              disabled={creating || (!customTagName.trim() && customTagType === "custom")}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className={fileLabelClass}>
              <ImageIcon className="h-3.5 w-3.5" /> Optional image
            </Label>
            <Input
              type="file"
              accept={IMAGE_ACCEPT_ATTR}
              className={fileInputClass}
              onChange={e => {
                const f = e.target.files?.[0] || null
                if (preview) URL.revokeObjectURL(preview)
                setCustomTagFile(f)
                setPreview(f ? URL.createObjectURL(f) : null)
              }}
            />
            {preview && (
              <div className={previewTextClass}>
                <span className={previewChipClass}>Preview</span>
                <button type="button" className="rounded-full bg-transparent border-none shadow-none" onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setCustomTagFile(null) }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className={searchIconClass} />
        <Input
          placeholder="Search tags..."
          className={searchClass}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className={selectedTagClass}
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="rounded-full p-0.5 hover:bg-accent/20 bg-transparent border-none shadow-none"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tag grid */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[240px] overflow-y-auto pr-1">
          {filteredTags.map(tag => {
            const isSelected = selectedTags.includes(tag.name)
            const imageUrl = resolveTagImage(tag)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name, imageUrl)}
                className={`${tagButtonBaseClass} ${
                  isSelected
                    ? tagButtonSelectedClass
                    : tagButtonIdleClass
                }`}
              >
                {imageUrl ? (
                  <div className="relative h-12 w-full overflow-hidden rounded-lg">
                    <img
                      src={resolveUrl(imageUrl)}
                      alt={tag.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-accent/30">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={tagFallbackClass(isSelected)}>
                    <TagIcon className={tagFallbackIconClass(isSelected)} />
                  </div>
                )}
                <span className={tagNameClass(isSelected)}>
                  {tag.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && filteredTags.length === 0 && search && (
        <p className={emptyStateClass}>No tags found. Create a custom one!</p>
      )}
    </div>
  )
}


