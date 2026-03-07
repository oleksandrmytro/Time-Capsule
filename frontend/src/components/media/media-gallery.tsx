import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, X, Play, Image as ImageIcon, Film } from "lucide-react"
import type { MediaItem } from "@/services/api"

interface MediaGalleryProps {
  media: MediaItem[]
  className?: string
}

export function MediaGallery({ media, className }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  if (media.length === 0) return null

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
      <div className={`grid gap-2 ${getGridClass()}`}>
        {media.map((item, index) => (
          <button key={item.id} onClick={() => setSelectedIndex(index)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted transition-all hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.type === "image" ? (
              <img src={item.thumbnail || item.url} alt={item.alt || `Media ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            ) : (
              <>
                <img src={item.thumbnail || item.url} alt={item.alt || `Video ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 transition-transform group-hover:scale-110"><Play className="h-4 w-4 text-foreground" /></div>
                </div>
              </>
            )}
            <div className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80">
              {item.type === "image" ? <ImageIcon className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
            </div>
          </button>
        ))}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none" onKeyDown={(e) => { if (e.key === "ArrowLeft") goToPrevious(); if (e.key === "ArrowRight") goToNext(); if (e.key === "Escape") closeLightbox() }}>
          <DialogTitle className="sr-only">Media viewer</DialogTitle>
          {selectedIndex !== null && (
            <div className="relative flex items-center justify-center">
              <Button variant="ghost" size="icon" onClick={closeLightbox} className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-background/80"><X className="h-4 w-4" /></Button>
              {media.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" onClick={goToPrevious} className="absolute left-2 z-10 h-10 w-10 rounded-full bg-background/80"><ChevronLeft className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={goToNext} className="absolute right-14 z-10 h-10 w-10 rounded-full bg-background/80"><ChevronRight className="h-5 w-5" /></Button>
                </>
              )}
              <div className="flex max-h-[85vh] max-w-[90vw] items-center justify-center">
                {media[selectedIndex].type === "image" ? (
                  <img src={media[selectedIndex].url} alt={media[selectedIndex].alt || "Full size"} className="max-h-[85vh] w-auto rounded-lg object-contain" />
                ) : (
                  <video src={media[selectedIndex].url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
                )}
              </div>
              {media.length > 1 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium">{selectedIndex + 1} / {media.length}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

