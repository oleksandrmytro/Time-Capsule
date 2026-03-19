import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, ImageIcon } from "lucide-react"

/**
 * coverValue — зовнішнє значення:
 *   - null         → нічого не вибрано
 *   - string       → URL вже збережений (напр. /static/tags/travel.jpg)
 *   - File         → файл вибраний користувачем (ще не завантажений)
 *
 * onCoverChange(value) повертає те саме.
 * Blob URL існує ТІЛЬКИ всередині компонента для <img> — назовні не передається.
 */
interface CoverUploaderProps {
  coverValue: File | string | null
  onCoverChange: (value: File | string | null) => void
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE_MB = 10

export function CoverUploader({ coverValue, onCoverChange }: CoverUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // blobUrl існує тільки коли coverValue — це File
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Синхронізуємо blobUrl з coverValue
  useEffect(() => {
    if (coverValue instanceof File) {
      const url = URL.createObjectURL(coverValue)
      setBlobUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    } else {
      setBlobUrl(null)
    }
  }, [coverValue])

  // Визначаємо src для <img>
  const previewSrc: string | null =
    coverValue instanceof File
      ? blobUrl
      : typeof coverValue === "string"
        ? coverValue
        : null

  const handleFile = useCallback((file: File) => {
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, GIF, WebP images are supported")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_SIZE_MB}MB`)
      return
    }
    // Передаємо File, blob URL НЕ виходить назовні
    onCoverChange(file)
  }, [onCoverChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleRemove = useCallback(() => {
    setError(null)
    onCoverChange(null)
  }, [onCoverChange])

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {previewSrc ? (
        <div className="relative group overflow-hidden rounded-xl border border-border">
          <img
            src={previewSrc}
            alt="Cover preview"
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleRemove}
            >
              <X className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors ${
            isDragging
              ? "border-accent bg-accent/5"
              : "border-border bg-muted/30 hover:border-accent/50 hover:bg-muted/50"
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isDragging ? "bg-accent/10" : "bg-secondary"}`}>
            <ImageIcon className={`h-4 w-4 ${isDragging ? "text-accent" : "text-muted-foreground"}`} />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {isDragging ? "Drop image here" : "Drag & drop or click to add cover image"}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0])
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
        className="hidden"
      />
    </div>
  )
}
