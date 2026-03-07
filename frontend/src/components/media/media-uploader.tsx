import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertBanner } from "@/components/alert-banner"
import { Upload, X, Image as ImageIcon, Film, Loader2, FileWarning } from "lucide-react"

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
}

const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"]
const DEFAULT_MAX_SIZE_MB = 50

export function MediaUploader({ files, onFilesChange, maxFiles = 10, maxSizeMB = DEFAULT_MAX_SIZE_MB, acceptedTypes = DEFAULT_ACCEPTED_TYPES }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) return `File type "${file.type}" is not supported`
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
        type: file.type.startsWith("video/") ? "video" : "image",
      })
    }
    if (newFiles.length > 0) onFilesChange([...files, ...newFiles])
  }, [files, maxFiles, onFilesChange, validateFile])

  const removeFile = useCallback((id: string) => {
    const file = files.find((f) => f.id === id)
    if (file) URL.revokeObjectURL(file.preview)
    onFilesChange(files.filter((f) => f.id !== id))
  }, [files, onFilesChange])

  return (
    <div className="flex flex-col gap-4">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files) }}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${isDragging ? "border-accent bg-accent/5" : "border-border bg-muted/30 hover:border-accent/50 hover:bg-muted/50"}`}
        onClick={() => fileInputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
      >
        <input ref={fileInputRef} type="file" accept={acceptedTypes.join(",")} multiple onChange={(e) => { if (e.target.files) processFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = "" }} className="hidden" />
        <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${isDragging ? "bg-accent/10" : "bg-secondary"}`}>
          <Upload className={`h-5 w-5 ${isDragging ? "text-accent" : "text-muted-foreground"}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{isDragging ? "Drop files here" : "Drag & drop or click to upload"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Images & videos up to {maxSizeMB}MB each. Max {maxFiles} files.</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((mediaFile) => (
            <div key={mediaFile.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {mediaFile.type === "image" ? (
                <img src={mediaFile.preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <video src={mediaFile.preview} className="h-full w-full object-cover" muted playsInline />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); removeFile(mediaFile.id) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80">
                {mediaFile.type === "image" ? <ImageIcon className="h-3 w-3 text-foreground" /> : <Film className="h-3 w-3 text-foreground" />}
              </div>
              {mediaFile.uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>}
              {mediaFile.error && <div className="absolute inset-0 flex items-center justify-center bg-destructive/20"><FileWarning className="h-6 w-6 text-destructive" /></div>}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} of {maxFiles} files selected</p>}
    </div>
  )
}

