const FILE_NAME_WITH_EXT_RE = /^[^/\\]+\.[a-z0-9]{2,5}$/i

export function resolveTagImageUrl(rawUrl: string | null | undefined, isSystem: boolean): string | undefined {
  if (!rawUrl) return undefined
  const trimmed = rawUrl.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed
  }

  const normalized = trimmed.replace(/\\/g, "/")

  if (normalized.startsWith("/static/tags/")) return normalized
  if (normalized.startsWith("/uploads/")) return normalized
  if (normalized.startsWith("static/tags/")) return `/${normalized}`
  if (normalized.startsWith("uploads/")) return `/${normalized}`
  if (normalized.startsWith("/static/uploads/")) return normalized.replace("/static/uploads/", "/uploads/")
  if (normalized.startsWith("static/uploads/")) return `/${normalized.replace("static/uploads/", "uploads/")}`
  if (normalized.startsWith("/tags/")) return isSystem ? `/static${normalized}` : `/uploads${normalized}`
  if (normalized.startsWith("tags/")) return isSystem ? `/static/${normalized}` : `/uploads/${normalized}`

  if (FILE_NAME_WITH_EXT_RE.test(normalized)) {
    return isSystem ? `/static/tags/${normalized}` : `/uploads/tags/${normalized}`
  }

  return undefined
}
