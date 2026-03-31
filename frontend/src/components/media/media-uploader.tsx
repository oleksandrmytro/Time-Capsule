import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertBanner } from "@/components/alert-banner"
import { Upload, X, Image as ImageIcon, Film, Loader2, FileWarning } from "lucide-react"
import {
  MEDIA_MIME_TYPES,
  isSupportedVideoMimeType,
  toAcceptAttribute,
  toFileExtensions,
  toPickerTypes,
} from "@/lib/media-types"
import { openNativeFiles } from "@/lib/native-file-picker"

export interface MediaFile {
  id: string
  file: File
  preview: string
  type: "image" | "video"
  uploading?: boolean
  error?: string
}

interface MediaUploaderProps {
  files: MediaFile[]
  onFilesChange: (files: MediaFile[]) => void
  maxFiles?: number
  maxSizeMB?: number
  acceptedTypes?: string[]
  theme?: "default" | "cosmic"
}

const DEFAULT_ACCEPTED_TYPES = [...MEDIA_MIME_TYPES]
const DEFAULT_MAX_SIZE_MB = 50

export function MediaUploader({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  theme = "default",
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    const allowedFormats = toFileExtensions(acceptedTypes).join(", ")
    if (!acceptedTypes.includes(file.type)) return `Unsupported file type "${file.type || "unknown"}". Allowed formats: ${allowedFormats}`
    if (file.size > maxSizeMB * 1024 * 1024) return `File "${file.name}" exceeds ${maxSizeMB}MB limit`
    return null
  }, [acceptedTypes, maxSizeMB])

  const processFiles = useCallback((fileList: FileList | File[]) => {
    setError(null)
    const newFiles: MediaFile[] = []
    const filesToProcess = Array.from(fileList)
    if (files.length + filesToProcess.length > maxFiles) { setError(`You can only upload up to ${maxFiles} files`); return }
    for (const file of filesToProcess) {
      const validationError = validateFile(file)
      if (validationError) { setError(validationError); continue }
      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file, preview: URL.createObjectURL(file),
        type: isSupportedVideoMimeType(file.type) ? "video" : "image",
      })
    }
    if (newFiles.length > 0) onFilesChange([...files, ...newFiles])
  }, [files, maxFiles, onFilesChange, validateFile])

  const removeFile = useCallback((id: string) => {
    const file = files.find((f) => f.id === id)
    if (file) URL.revokeObjectURL(file.preview)
    onFilesChange(files.filter((f) => f.id !== id))
  }, [files, onFilesChange])

  const isCosmic = theme === "cosmic"
  const dropZoneClass = isCosmic
    ? (isDragging ? "border-cyan-300/45 bg-cyan-300/8" : "border-white/16 bg-white/[0.03] hover:border-cyan-300/38 hover:bg-white/[0.06]")
    : (isDragging ? "border-accent bg-accent/5" : "border-border bg-muted/30 hover:border-accent/50 hover:bg-muted/50")
  const iconFrameClass = isCosmic
    ? (isDragging ? "bg-cyan-300/12" : "bg-white/[0.06]")
    : (isDragging ? "bg-accent/10" : "bg-secondary")
  const iconClass = isCosmic
    ? (isDragging ? "text-cyan-200" : "text-slate-300")
    : (isDragging ? "text-accent" : "text-muted-foreground")
  const headingClass = isCosmic ? "text-sm font-medium text-slate-100" : "text-sm font-medium text-foreground"
  const helpClass = isCosmic ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs text-muted-foreground"
  const previewTileClass = isCosmic
    ? "group relative aspect-square overflow-hidden rounded-lg border border-white/12 bg-slate-950/55"
    : "group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
  const previewOverlayClass = isCosmic
    ? "absolute inset-0 flex items-center justify-center bg-slate-950/72 opacity-0 transition-opacity group-hover:opacity-100"
    : "absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100"
  const previewIconBadgeClass = isCosmic
    ? "absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/82"
    : "absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80"
  const previewIconClass = isCosmic ? "h-3 w-3 text-slate-100" : "h-3 w-3 text-foreground"
  const countClass = isCosmic ? "text-xs text-slate-300" : "text-xs text-muted-foreground"
  const acceptedExtensionsDescription = toFileExtensions(acceptedTypes).join(", ")
  const acceptAttr = toAcceptAttribute(acceptedTypes)
  const pickerTypes = toPickerTypes(acceptedTypes)

  const openFilePicker = async () => {
    const selectedFiles = await openNativeFiles({
      multiple: true,
      types: pickerTypes,
      excludeAcceptAllOption: false,
    })
    if (selectedFiles === null) {
      fileInputRef.current?.click()
      return
    }
    if (selectedFiles.length > 0) processFiles(selectedFiles)
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files) }}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${dropZoneClass}`}
        onClick={openFilePicker}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void openFilePicker() }}
      >
        <input ref={fileInputRef} type="file" accept={acceptAttr} multiple onChange={(e) => { if (e.target.files) processFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = "" }} className="hidden" />
        <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${iconFrameClass}`}>
          <Upload className={`h-5 w-5 ${iconClass}`} />
        </div>
        <div className="text-center">
          <p className={headingClass}>{isDragging ? "Drop files here" : "Drag & drop or click to upload"}</p>
          <p className={helpClass}>Allowed formats: {acceptedExtensionsDescription}. Up to {maxSizeMB}MB each. Max {maxFiles} files.</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((mediaFile) => (
            <div key={mediaFile.id} className={previewTileClass}>
              {mediaFile.type === "image" ? (
                <img src={mediaFile.preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <video src={mediaFile.preview} className="h-full w-full object-cover" muted playsInline />
              )}
              <div className={previewOverlayClass}>
                <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); removeFile(mediaFile.id) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className={previewIconBadgeClass}>
                {mediaFile.type === "image" ? <ImageIcon className={previewIconClass} /> : <Film className={previewIconClass} />}
              </div>
              {mediaFile.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>}
              {mediaFile.error && <div className="absolute inset-0 flex items-center justify-center bg-destructive/20"><FileWarning className="h-6 w-6 text-destructive" /></div>}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && <p className={countClass}>{files.length} of {maxFiles} files selected</p>}
    </div>
  )
}

