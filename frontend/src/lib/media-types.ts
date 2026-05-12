export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const

export const MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES] as const

export const IMAGE_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"] as const
export const VIDEO_FILE_EXTENSIONS = [".mp4", ".webm", ".mov"] as const
export const MEDIA_FILE_EXTENSIONS = [...IMAGE_FILE_EXTENSIONS, ...VIDEO_FILE_EXTENSIONS] as const

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number]
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number]
export type FilePickerTypeOption = {
  description: string
  accept: Record<string, string[]>
}

const IMAGE_MIME_TYPE_SET = new Set<string>(IMAGE_MIME_TYPES)
const VIDEO_MIME_TYPE_SET = new Set<string>(VIDEO_MIME_TYPES)
const MEDIA_MIME_TYPE_SET = new Set<string>(MEDIA_MIME_TYPES)
const MIME_TO_FILE_EXTENSIONS: Readonly<Record<MediaMimeType, readonly string[]>> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
}

export function toFileExtensions(mimeTypes: readonly string[]): string[] {
  const extensions = new Set<string>()
  mimeTypes.forEach((mimeType) => {
    const mapped = MIME_TO_FILE_EXTENSIONS[mimeType as MediaMimeType]
    if (mapped) mapped.forEach((extension) => extensions.add(extension))
  })
  return Array.from(extensions)
}

export function toAcceptAttribute(mimeTypes: readonly string[]): string {
  const extensions = toFileExtensions(mimeTypes)
  // Use extensions in the native file picker so Windows dialog shows explicit file type filters.
  return extensions.join(",")
}

export function toPickerTypes(mimeTypes: readonly string[]): FilePickerTypeOption[] {
  const normalizedMimeTypes = Array.from(
    new Set(
      mimeTypes.filter((mimeType): mimeType is MediaMimeType => MEDIA_MIME_TYPE_SET.has(mimeType)),
    ),
  )
  const types: FilePickerTypeOption[] = []

  if (normalizedMimeTypes.length === 0) return types

  if (normalizedMimeTypes.length > 1) {
    const allAccept: Record<string, string[]> = {}
    normalizedMimeTypes.forEach((mimeType) => {
      allAccept[mimeType] = toFileExtensions([mimeType])
    })
    types.push({
      description: `All supported (${toFileExtensions(normalizedMimeTypes).join(", ")})`,
      accept: allAccept,
    })
  }

  const labelByMimeType: Record<MediaMimeType, string> = {
    "image/jpeg": "JPEG images",
    "image/png": "PNG images",
    "image/gif": "GIF images",
    "image/webp": "WEBP images",
    "video/mp4": "MP4 videos",
    "video/webm": "WEBM videos",
    "video/quicktime": "MOV videos",
  }

  normalizedMimeTypes.forEach((mimeType) => {
    const extensions = toFileExtensions([mimeType])
    types.push({
      description: `${labelByMimeType[mimeType]} (${extensions.join(", ")})`,
      accept: { [mimeType]: extensions },
    })
  })

  return types
}

export const IMAGE_ACCEPT_ATTR = toAcceptAttribute(IMAGE_MIME_TYPES)
export const VIDEO_ACCEPT_ATTR = toAcceptAttribute(VIDEO_MIME_TYPES)
export const MEDIA_ACCEPT_ATTR = toAcceptAttribute(MEDIA_MIME_TYPES)

export function isSupportedImageMimeType(value: string | null | undefined): value is ImageMimeType {
  return Boolean(value) && IMAGE_MIME_TYPE_SET.has(value)
}

export function isSupportedVideoMimeType(value: string | null | undefined): value is VideoMimeType {
  return Boolean(value) && VIDEO_MIME_TYPE_SET.has(value)
}

export function isSupportedMediaMimeType(value: string | null | undefined): value is MediaMimeType {
  return Boolean(value) && MEDIA_MIME_TYPE_SET.has(value)
}
