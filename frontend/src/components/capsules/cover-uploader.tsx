import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, ImageIcon } from "lucide-react"
import { IMAGE_ACCEPT_ATTR, IMAGE_FILE_EXTENSIONS, IMAGE_MIME_TYPES, isSupportedImageMimeType, toPickerTypes } from "@/lib/media-types"
import { openNativeFiles } from "@/lib/native-file-picker"

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
  theme?: "default" | "cosmic"
}

const MAX_SIZE_MB = 10

export function CoverUploader({ coverValue, onCoverChange, theme = "default" }: CoverUploaderProps) {
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
    if (!isSupportedImageMimeType(file.type)) {
      setError(`Unsupported image type. Allowed formats: ${IMAGE_FILE_EXTENSIONS.join(", ")}`)
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

  const openFilePicker = async () => {
    const selectedFiles = await openNativeFiles({
      multiple: false,
      types: toPickerTypes(IMAGE_MIME_TYPES),
      excludeAcceptAllOption: false,
    })
    if (selectedFiles === null) {
      fileInputRef.current?.click()
      return
    }
    if (selectedFiles[0]) handleFile(selectedFiles[0])
  }

  const isCosmic = theme === "cosmic"
  const errorClass = isCosmic ? "text-xs text-rose-300" : "text-xs text-destructive"
  const previewFrameClass = isCosmic ? "relative group overflow-hidden rounded-xl border border-white/12" : "relative group overflow-hidden rounded-xl border border-border"
  const previewOverlayClass = isCosmic
    ? "absolute inset-0 flex items-center justify-center bg-slate-950/70 opacity-0 transition-opacity group-hover:opacity-100"
    : "absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100"
  const dropZoneClass = isCosmic
    ? (isDragging
      ? "border-cyan-300/45 bg-cyan-300/8"
      : "border-white/16 bg-white/[0.03] hover:border-cyan-300/38 hover:bg-white/[0.06]")
    : (isDragging
      ? "border-accent bg-accent/5"
      : "border-border bg-muted/30 hover:border-accent/50 hover:bg-muted/50")
  const iconFrameClass = isCosmic
    ? (isDragging ? "bg-cyan-300/12" : "bg-white/[0.05]")
    : (isDragging ? "bg-accent/10" : "bg-secondary")
  const iconClass = isCosmic
    ? (isDragging ? "text-cyan-200" : "text-slate-300")
    : (isDragging ? "text-accent" : "text-muted-foreground")
  const captionClass = isCosmic ? "text-xs text-slate-300 text-center" : "text-xs text-muted-foreground text-center"

  return (
    <div className="flex flex-col gap-2">
      {error && <p className={errorClass}>{error}</p>}

      {previewSrc ? (
        <div className={previewFrameClass}>
          <img
            src={previewSrc}
            alt="Cover preview"
            className="h-40 w-full object-cover"
          />
          <div className={previewOverlayClass}>
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
          onClick={openFilePicker}
          className={`flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors ${dropZoneClass}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void openFilePicker() }}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${iconFrameClass}`}>
            <ImageIcon className={`h-4 w-4 ${iconClass}`} />
          </div>
          <p className={captionClass}>
            {isDragging ? "Drop image here" : "Drag & drop or click to add cover image"}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0])
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
        className="hidden"
      />
    </div>
  )
}
