import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, X, Play, Image as ImageIcon, Film } from "lucide-react"
import { getApiBase, type MediaItem } from "@/services/api"

interface MediaGalleryProps {
  media: MediaItem[]
  className?: string
  appearance?: "default" | "dark"
}

export function MediaGallery({ media, className, appearance = "default" }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  if (media.length === 0) return null
  const isDark = appearance === "dark"
  const hasSingleItem = media.length === 1

  const resolveUrl = (url?: string) => {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/")) return `${getApiBase()}${url}`
    return `${getApiBase()}/${url}`
  }

  const getMediaLabel = (item: MediaItem, index: number) => item.alt || `${item.type === "video" ? "Video" : "Image"} ${index + 1}`

  const closeLightbox = () => setSelectedIndex(null)
  const goToPrevious = () => { if (selectedIndex !== null) setSelectedIndex(selectedIndex === 0 ? media.length - 1 : selectedIndex - 1) }
  const goToNext = () => { if (selectedIndex !== null) setSelectedIndex(selectedIndex === media.length - 1 ? 0 : selectedIndex + 1) }

  const getGridClass = () => {
    if (media.length === 1) return "grid-cols-1"
    if (media.length === 2) return "grid-cols-2"
    if (media.length === 3) return "grid-cols-2 sm:grid-cols-3"
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
  }

  return (
    <div className={className}>
      <div className={`grid gap-3 ${getGridClass()}`}>
        {media.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setSelectedIndex(index)}
            className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 ${
              isDark
                ? "border-cyan-200/14 bg-[linear-gradient(180deg,rgba(19,39,77,0.92)_0%,rgba(15,31,64,0.98)_100%)] shadow-[0_18px_48px_rgba(6,18,42,0.28)] hover:border-cyan-200/34 hover:shadow-[0_22px_54px_rgba(6,18,42,0.36)] focus-visible:ring-cyan-300/55"
                : "border-border bg-muted hover:border-accent focus-visible:ring-ring"
            } ${item.type === "video" ? (hasSingleItem ? "aspect-video" : "aspect-[4/5] sm:aspect-video") : "aspect-square"}`}
          >
            {item.type === "image" ? (
              <>
                <img
                  src={resolveUrl(item.thumbnail || item.url)}
                  alt={getMediaLabel(item, index)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? "from-[#0f1f42]/60 via-[#0f1f42]/8 to-transparent" : "from-background/60 via-transparent to-transparent"}`} />
              </>
            ) : (
              <>
                <video
                  src={resolveUrl(item.url)}
                  poster={item.thumbnail ? resolveUrl(item.thumbnail) : undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? "from-[#0f1f42]/70 via-[#0f1f42]/20 to-[#0f1f42]/6" : "from-background/70 via-background/20 to-transparent"}`} />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-foreground"}`}>
                      {getMediaLabel(item, index)}
                    </p>
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                      Video attachment
                    </p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110 ${isDark ? "border-cyan-200/20 bg-[#17335f]/84 text-slate-100 shadow-[0_12px_30px_rgba(6,18,42,0.28)]" : "border-border bg-background/85 text-foreground"}`}>
                    <Play className="h-4 w-4 fill-current" />
                  </div>
                </div>
              </>
            )}
            <div className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${isDark ? "border-cyan-200/16 bg-[#17335f]/84 text-slate-100 backdrop-blur-md" : "border-border bg-background/80 text-foreground"}`}>
              {item.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
              <span>{item.type === "image" ? "Image" : "Video"}</span>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] border-none bg-transparent p-0 shadow-none" onKeyDown={(e) => { if (e.key === "ArrowLeft") goToPrevious(); if (e.key === "ArrowRight") goToNext(); if (e.key === "Escape") closeLightbox() }}>
          <DialogTitle className="sr-only">Media viewer</DialogTitle>
          {selectedIndex !== null && (
            <div className="relative flex items-center justify-center">
              <Button variant="ghost" size="icon" onClick={closeLightbox} className={`absolute right-3 top-3 z-20 h-10 w-10 rounded-full border ${isDark ? "border-cyan-200/22 bg-[#17335f]/82 text-slate-100 hover:border-cyan-200/45 hover:bg-cyan-300/20 hover:text-white" : "border-border bg-background/85"}`}><X className="h-4 w-4" /></Button>
              {media.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" onClick={goToPrevious} className={`absolute left-3 z-20 h-11 w-11 rounded-full border ${isDark ? "border-cyan-200/22 bg-[#17335f]/82 text-slate-100 hover:border-cyan-200/45 hover:bg-cyan-300/20 hover:text-white" : "border-border bg-background/85"}`}><ChevronLeft className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={goToNext} className={`absolute right-16 z-20 h-11 w-11 rounded-full border ${isDark ? "border-cyan-200/22 bg-[#17335f]/82 text-slate-100 hover:border-cyan-200/45 hover:bg-cyan-300/20 hover:text-white" : "border-border bg-background/85"}`}><ChevronRight className="h-5 w-5" /></Button>
                </>
              )}
                <div className={`relative flex max-h-[88vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-[28px] border ${isDark ? "border-cyan-200/14 bg-[linear-gradient(180deg,rgba(19,39,77,0.94)_0%,rgba(13,27,56,0.98)_100%)] shadow-[0_40px_120px_rgba(6,18,42,0.56)]" : "border-border bg-background shadow-2xl"}`}>
                {media[selectedIndex].type === "image" ? (
                  <img
                    src={resolveUrl(media[selectedIndex].url)}
                    alt={media[selectedIndex].alt || "Full size"}
                    className="max-h-[88vh] w-auto max-w-[92vw] object-contain"
                  />
                ) : (
                  <div className="flex max-h-[88vh] w-[min(92vw,1100px)] flex-col">
                    <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${isDark ? "border-cyan-200/12 bg-[#17335f]/58" : "border-border bg-muted/70"}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-foreground"}`}>
                          {getMediaLabel(media[selectedIndex], selectedIndex)}
                        </p>
                        <p className={`text-xs ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
                          Video attachment
                        </p>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${isDark ? "border-cyan-200/24 bg-cyan-300/14 text-cyan-50" : "border-border bg-background/80 text-foreground"}`}>
                        <Film className="h-3 w-3" />
                        <span>Video</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center bg-black/30 p-3 sm:p-5">
                      <video
                        src={resolveUrl(media[selectedIndex].url)}
                        controls
                        autoPlay
                        playsInline
                        preload="metadata"
                        poster={media[selectedIndex].thumbnail ? resolveUrl(media[selectedIndex].thumbnail) : undefined}
                        className="max-h-[76vh] w-full rounded-2xl bg-[#07101f] object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
              {media.length > 1 && <div className={`absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1 text-xs font-medium ${isDark ? "border-white/12 bg-slate-950/82 text-slate-100" : "border-border bg-background/85"}`}>{selectedIndex + 1} / {media.length}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

