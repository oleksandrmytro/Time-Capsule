import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X, Plus, Search, Check, Tag as TagIcon, Loader2, Image as ImageIcon } from "lucide-react"
import { listTags, createTag, type Tag } from "@/services/api"

interface TagPickerProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onCoverSuggestion?: (url: string) => void
}

export function TagPicker({ selectedTags, onTagsChange, onCoverSuggestion }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [customTagName, setCustomTagName] = useState("")
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

  const resolveUrl = (url?: string | null) => {
    if (!url) return undefined
    // Keep relative URLs as-is — nginx will proxy /static/tags/* to backend
    return url
  }

  const resolveTagImage = (tag: Tag) => {
    const url = tag.imageUrl
    if (!url) return undefined

    if (tag.isSystem) {
      return url.startsWith("/static/tags/") ? url : undefined
    }

    if (url.startsWith("/uploads/tags/") || url.startsWith("/uploads/")) {
      return url
    }

    return undefined
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
    const name = customTagName.trim()
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
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <TagIcon className="h-4 w-4" /> Tags
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowCreateInput(!showCreateInput)}
        >
          <Plus className="h-3 w-3" /> Custom Tag
        </Button>
      </div>

      {showCreateInput && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex gap-2">
            <Input
              placeholder="New tag name..."
              className="h-9 text-sm"
              value={customTagName}
              onChange={e => setCustomTagName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag() } }}
            />
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={handleCreateTag}
              disabled={creating || !customTagName.trim()}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> Optional image
            </Label>
            <Input
              type="file"
              accept="image/*"
              className="h-9 text-xs"
              onChange={e => {
                const f = e.target.files?.[0] || null
                if (preview) URL.revokeObjectURL(preview)
                setCustomTagFile(f)
                setPreview(f ? URL.createObjectURL(f) : null)
              }}
            />
            {preview && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">Preview</span>
                <button type="button" className="rounded-full bg-transparent border-none shadow-none" onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setCustomTagFile(null) }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tags..."
          className="h-9 pl-9 text-sm"
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
              className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent-foreground"
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
                className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-all cursor-pointer bg-transparent shadow-none ${
                  isSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                    : "border-border hover:border-accent/40 hover:bg-muted/50"
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
                  <div className={`flex h-12 w-full items-center justify-center rounded-lg ${isSelected ? "bg-accent/20" : "bg-muted"}`}>
                    <TagIcon className={`h-4 w-4 ${isSelected ? "text-accent" : "text-muted-foreground"}`} />
                  </div>
                )}
                <span className={`text-[11px] font-medium leading-tight ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`}>
                  {tag.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && filteredTags.length === 0 && search && (
        <p className="text-center text-xs text-muted-foreground py-3">No tags found. Create a custom one!</p>
      )}
    </div>
  )
}


