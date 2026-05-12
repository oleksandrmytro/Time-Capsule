import { getApiBase } from "@/services/api"

export function resolveAssetUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl) return undefined
  const trimmed = rawUrl.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`
  }

  if (trimmed.startsWith("/")) {
    return `${getApiBase()}${trimmed}`
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return `${getApiBase()}/${trimmed}`
}
