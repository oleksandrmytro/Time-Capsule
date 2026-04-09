import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Crosshair, Globe, Link2, Loader2, Lock, LocateFixed, MapPin, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertBanner } from "@/components/alert-banner"
import { CoverUploader } from "@/components/capsules/cover-uploader"
import { TagPicker } from "@/components/capsules/tag-picker"
import { MediaUploader, type MediaFile } from "@/components/media/media-uploader"
import { getApiBase, uploadCapsuleAttachment, uploadCoverImage } from "@/services/api"
import type { ApiError, Capsule, CreateCapsulePayload, MediaItem } from "@/services/api"
import { SpaceBackgroundFrame } from "@/components/space-background-frame"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "./create-capsule-form.css"

interface NominatimPlace {
  place_id: string | number
  display_name: string
  lat: string
  lon: string
  type?: string
}

interface CreateCapsuleFormProps {
  onSubmit: (data: CreateCapsulePayload) => Promise<Capsule>
  onCancel?: () => void
  error: ApiError | null
  initialCapsule?: Capsule | null
  mode?: "create" | "edit"
  onSubmitted?: (capsule: Capsule) => void
}

const PICKER_DEFAULT_CENTER: [number, number] = [26, 12]
const PICKER_DEFAULT_ZOOM = 2
const OSM_TILE_URL = "/tiles/osm/{z}/{x}/{y}.png"
const CARTO_TILE_URL = "/tiles/carto-dark/{z}/{x}/{y}{r}.png"
const DIRECT_OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const DIRECT_CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function resolveAssetUrl(url?: string | null): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${getApiBase()}${url}`
  return `${getApiBase()}/${url}`
}

function forceLeafletLayout(map: L.Map) {
  const sync = () => {
    map.invalidateSize(true)
    map.setView(map.getCenter(), map.getZoom(), { animate: false })
  }
  sync()
  const t1 = window.setTimeout(sync, 220)
  const t2 = window.setTimeout(sync, 650)
  return () => {
    window.clearTimeout(t1)
    window.clearTimeout(t2)
  }
}

function bindFreeTileLayer(map: L.Map) {
  const attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  const layers = [
    L.tileLayer(OSM_TILE_URL, {
      attribution,
      maxZoom: 19,
    }),
    L.tileLayer(DIRECT_OSM_TILE_URL, {
      attribution,
      maxZoom: 19,
    }),
    L.tileLayer(CARTO_TILE_URL, {
      attribution: `${attribution} &copy; <a href="https://carto.com/">CARTO</a>`,
      subdomains: "",
      maxZoom: 20,
    }),
    L.tileLayer(DIRECT_CARTO_TILE_URL, {
      attribution: `${attribution} &copy; <a href="https://carto.com/">CARTO</a>`,
      subdomains: ["a", "b", "c", "d"],
      maxZoom: 20,
    }),
  ]

  const ERROR_THRESHOLD = 2
  const RETRY_DELAY_MS = 3500
  let activeIndex = 0
  let errorCount = 0
  let retryTimer: number | null = null
  let activeLayer: L.TileLayer | null = null

  const clearRetry = () => {
    if (retryTimer != null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleRetryFromFirst = () => {
    clearRetry()
    retryTimer = window.setTimeout(() => {
      attach(0)
    }, RETRY_DELAY_MS)
  }

  const detach = (layer: L.TileLayer) => {
    layer.off("tileerror", onTileError)
    layer.off("tileload", onTileLoad)
    if (map.hasLayer(layer)) map.removeLayer(layer)
  }

  const attach = (index: number) => {
    clearRetry()
    if (activeLayer) {
      detach(activeLayer)
      activeLayer = null
    }
    if (index >= layers.length) {
      scheduleRetryFromFirst()
      return
    }
    activeIndex = index
    errorCount = 0
    const layer = layers[index]
    layer.on("tileerror", onTileError)
    layer.on("tileload", onTileLoad)
    layer.addTo(map)
    activeLayer = layer
  }

  const switchToNextLayer = () => {
    attach(activeIndex + 1)
  }

  const onTileLoad = () => {
    errorCount = 0
  }

  const onTileError = () => {
    errorCount += 1
    if (errorCount < ERROR_THRESHOLD) return
    switchToNextLayer()
  }

  attach(0)

  const recoverOnMove = () => {
    if (!activeLayer || map.hasLayer(activeLayer)) return
    scheduleRetryFromFirst()
  }
  map.on("moveend zoomend", recoverOnMove)

  return () => {
    map.off("moveend zoomend", recoverOnMove)
    clearRetry()
    for (const layer of layers) {
      detach(layer)
    }
  }
}

export function CreateCapsuleForm({
  onSubmit,
  onCancel,
  error: parentError,
  initialCapsule = null,
  mode = "create",
  onSubmitted,
}: CreateCapsuleFormProps) {
  const isEditMode = mode === "edit"
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [unlockAt, setUnlockAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [coverValue, setCoverValue] = useState<File | string | null>(null)
  const [visibility, setVisibility] = useState("private")
  const [status, setStatus] = useState("sealed")
  const [allowComments, setAllowComments] = useState(true)
  const [allowReactions, setAllowReactions] = useState(true)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>([])

  const [useLocation, setUseLocation] = useState(false)
  const [locationLat, setLocationLat] = useState("")
  const [locationLon, setLocationLon] = useState("")
  const [locationLabel, setLocationLabel] = useState("")

  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")
  const [pickerResults, setPickerResults] = useState<NominatimPlace[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [pickerLat, setPickerLat] = useState("")
  const [pickerLon, setPickerLon] = useState("")
  const [pickerLabel, setPickerLabel] = useState("")

  const [pickerMapHostEl, setPickerMapHostEl] = useState<HTMLDivElement | null>(null)
  const pickerMapRef = useRef<any>(null)
  const pickerTileLayerRef = useRef<any>(null)
  const pickerMarkerRef = useRef<any>(null)

  const navigate = useNavigate()

  useEffect(() => {
    if (!isEditMode || !initialCapsule) return

    setTitle(initialCapsule.title || "")
    setBody(initialCapsule.body || "")
    setUnlockAt(toDateTimeLocalValue(initialCapsule.unlockAt))
    setExpiresAt(toDateTimeLocalValue(initialCapsule.expiresAt))
    setTags(Array.isArray(initialCapsule.tags) ? initialCapsule.tags : [])
    setCoverValue(initialCapsule.coverImageUrl || null)
    setVisibility(initialCapsule.visibility || "private")
    setStatus(initialCapsule.status || "sealed")
    setAllowComments(Boolean(initialCapsule.allowComments))
    setAllowReactions(Boolean(initialCapsule.allowReactions))
    setExistingMedia(Array.isArray(initialCapsule.media) ? initialCapsule.media : [])
    setMediaFiles([])

    const coordinates = initialCapsule.location?.coordinates
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    ) {
      const lon = Number(coordinates[0])
      const lat = Number(coordinates[1])
      setUseLocation(true)
      setLocationLat(lat.toFixed(6))
      setLocationLon(lon.toFixed(6))
      setLocationLabel("Saved location")
      setPickerLat(lat.toFixed(6))
      setPickerLon(lon.toFixed(6))
      setPickerLabel("Saved location")
    } else {
      setUseLocation(false)
      setLocationLat("")
      setLocationLon("")
      setLocationLabel("")
      setPickerLat("")
      setPickerLon("")
      setPickerLabel("")
    }
  }, [isEditMode, initialCapsule])

  useEffect(() => {
    if (visibility !== "public") {
      setAllowComments(false)
      setAllowReactions(false)
    }
  }, [visibility])

  const error = parentError || localError

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 1)
  const maxDate = new Date("2100-12-31T23:59")
  const minDateString = minDate.toISOString().slice(0, 16)
  const maxDateString = maxDate.toISOString().slice(0, 16)

  const sectionCardClass = "rounded-2xl border border-white/12 bg-slate-900/40 p-4 backdrop-blur-xl shadow-[0_20px_54px_rgba(2,6,23,0.38)] sm:p-5"
  const sectionTitleClass = "text-xs font-semibold uppercase tracking-[0.16em] text-slate-300/80"
  const inputClass = "h-11 rounded-xl border border-white/12 bg-white/[0.04] text-slate-100 placeholder:text-slate-400 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
  const pickerInputClass = `${inputClass} capsule-dark-input`
  const textareaClass = "min-h-[120px] resize-y rounded-xl border border-white/12 bg-white/[0.04] text-slate-100 placeholder:text-slate-400 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
  const selectTriggerClass = "h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] text-slate-100 focus:border-violet-300/55 focus:ring-1 focus:ring-violet-300/60"
  const selectContentClass = "border-white/12 bg-[#0b1328] text-slate-100"
  const selectItemClass = "text-slate-200 focus:bg-violet-500/20 focus:text-slate-100"
  const switchClass = "border-white/30 data-[state=unchecked]:bg-slate-700/90 data-[state=checked]:bg-violet-500 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"

  const parsedLat = Number(locationLat)
  const parsedLon = Number(locationLon)
  const hasValidLocation =
    useLocation &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180

  function setPickerMarker(lat: number, lon: number) {
    const map = pickerMapRef.current
    if (!map) return
    if (!pickerMarkerRef.current) {
      pickerMarkerRef.current = L.circleMarker([lat, lon], {
        radius: 10,
        color: "#ffffff",
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.95,
      }).addTo(map)
      return
    }
    pickerMarkerRef.current.setLatLng([lat, lon])
  }

  function applyPickerPosition(lat: number, lon: number, label?: string, zoom = 8) {
    setPickerLat(lat.toFixed(6))
    setPickerLon(lon.toFixed(6))
    if (label) setPickerLabel(label)
    setPickerMarker(lat, lon)

    const map = pickerMapRef.current
    if (map) {
      map.setView([lat, lon], zoom, { animate: true })
    }
  }

  useEffect(() => {
    if (!locationPickerOpen || !pickerMapHostEl) return

    let stopLayoutForce: (() => void) | null = null
    const initId = window.setTimeout(() => {
      if (!pickerMapRef.current) {
        const container = pickerMapHostEl as any
        if (container?._leaflet_id) {
          try { delete container._leaflet_id } catch {}
          try { container._leaflet_id = undefined } catch {}
        }

        const map = L.map(container, {
          center: PICKER_DEFAULT_CENTER,
          zoom: PICKER_DEFAULT_ZOOM,
          minZoom: 2,
          maxZoom: 19,
          worldCopyJump: true,
          zoomControl: true,
          preferCanvas: true,
        })

        pickerTileLayerRef.current = bindFreeTileLayer(map)
        map.on("click", (e: any) => {
          applyPickerPosition(e.latlng.lat, e.latlng.lng, "Selected on map", Math.max(map.getZoom(), 8))
        })
        pickerMapRef.current = map
      }

      const map = pickerMapRef.current
      const initialLat = Number(pickerLat || locationLat)
      const initialLon = Number(pickerLon || locationLon)
      const hasInitial =
        Number.isFinite(initialLat) &&
        Number.isFinite(initialLon) &&
        initialLat >= -90 &&
        initialLat <= 90 &&
        initialLon >= -180 &&
        initialLon <= 180

      if (hasInitial) {
        setPickerMarker(initialLat, initialLon)
        map.setView([initialLat, initialLon], 8, { animate: false })
      } else {
        map.setView(PICKER_DEFAULT_CENTER, PICKER_DEFAULT_ZOOM, { animate: false })
      }

      stopLayoutForce = forceLeafletLayout(map)
    }, 0)

    return () => {
      window.clearTimeout(initId)
      stopLayoutForce?.()
    }
  }, [locationPickerOpen, pickerMapHostEl])

  useEffect(() => {
    if (locationPickerOpen) return
    pickerTileLayerRef.current?.()
    pickerTileLayerRef.current = null
    pickerMapRef.current?.remove?.()
    pickerMapRef.current = null
    pickerMarkerRef.current = null
  }, [locationPickerOpen])

  useEffect(() => {
    return () => {
      pickerTileLayerRef.current?.()
      pickerMapRef.current?.remove?.()
      pickerMapRef.current = null
      pickerTileLayerRef.current = null
      pickerMarkerRef.current = null
    }
  }, [])

  const searchLocation = async () => {
    const query = pickerSearch.trim()
    if (!query) {
      setPickerResults([])
      return
    }

    setPickerLoading(true)
    setPickerError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=en&limit=8&q=${encodeURIComponent(query)}`
      const response = await fetch(url, { method: "GET" })
      if (!response.ok) throw new Error(`Nominatim error ${response.status}`)
      const data = (await response.json()) as NominatimPlace[]
      setPickerResults(Array.isArray(data) ? data : [])
      if (!data?.length) {
        setPickerError("No places found for this query")
      }
    } catch (e: any) {
      setPickerResults([])
      setPickerError(e?.message || "Search failed")
    } finally {
      setPickerLoading(false)
    }
  }

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setPickerError("Geolocation is not supported in this browser")
      return
    }

    setPickerError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        applyPickerPosition(lat, lon, "Current location", 12)
      },
      (geoError) => {
        setPickerError(geoError.message || "Failed to get current location")
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }

  const openLocationPicker = () => {
    setPickerError(null)
    setPickerResults([])
    setPickerSearch("")
    setPickerLabel(locationLabel || "")
    setPickerLat(locationLat || "")
    setPickerLon(locationLon || "")
    setLocationPickerOpen(true)
  }

  const handleLocationPickerOpenChange = (open: boolean) => {
    setLocationPickerOpen(open)
    if (open) return
    const savedLat = Number(locationLat)
    const savedLon = Number(locationLon)
    const hasSavedLocation =
      Number.isFinite(savedLat) &&
      Number.isFinite(savedLon) &&
      savedLat >= -90 &&
      savedLat <= 90 &&
      savedLon >= -180 &&
      savedLon <= 180

    if (!hasSavedLocation) {
      setUseLocation(false)
    }
  }

  const clearLocation = () => {
    setUseLocation(false)
    setLocationLat("")
    setLocationLon("")
    setLocationLabel("")
    setPickerLat("")
    setPickerLon("")
    setPickerLabel("")
    setPickerResults([])
    setPickerSearch("")
  }

  const removeExistingMediaItem = (mediaId: string, mediaUrl: string) => {
    setExistingMedia((prev) => prev.filter((item) => item.id !== mediaId && item.url !== mediaUrl))
  }

  const applyLocationFromPicker = () => {
    const lat = Number(pickerLat)
    const lon = Number(pickerLon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setPickerError("Please choose a point on the map or search for a place")
      return
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setPickerError("Latitude/Longitude out of range")
      return
    }

    setUseLocation(true)
    setLocationLat(lat.toFixed(6))
    setLocationLon(lon.toFixed(6))
    setLocationLabel(pickerLabel || "Custom location")
    setLocationPickerOpen(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (!trimmedTitle) {
      setLocalError({ status: 0, message: "Title is required" })
      return
    }
    if (!unlockAt) {
      setLocalError({ status: 0, message: "Unlock date is required" })
      return
    }

    const unlockDate = new Date(unlockAt)
    const now = new Date()

    if (Number.isNaN(unlockDate.getTime())) {
      setLocalError({ status: 0, message: "Unlock date is invalid" })
      return
    }

    if (status === "sealed" && unlockDate <= now) {
      setLocalError({ status: 0, message: "Unlock date must be in the future for sealed capsules" })
      return
    }

    if (unlockDate.getFullYear() > 2100) {
      setLocalError({ status: 0, message: "Unlock year cannot exceed 2100" })
      return
    }

    if (expiresAt) {
      const expiresDate = new Date(expiresAt)
      if (Number.isNaN(expiresDate.getTime())) {
        setLocalError({ status: 0, message: "Expiry date is invalid" })
        return
      }
      if (expiresDate.getFullYear() > 2100) {
        setLocalError({ status: 0, message: "Expiry year cannot exceed 2100" })
        return
      }
      if (expiresDate <= unlockDate) {
        setLocalError({ status: 0, message: "Expiry date must be after unlock date" })
        return
      }
    }

    let locationPayload: CreateCapsulePayload["location"] = null
    if (useLocation) {
      const lat = Number(locationLat)
      const lon = Number(locationLon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setLocalError({ status: 0, message: "Please provide valid latitude and longitude" })
        return
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        setLocalError({ status: 0, message: "Latitude/Longitude out of range" })
        return
      }
      locationPayload = { type: "Point", coordinates: [lon, lat] }
    }

    setIsLoading(true)
    try {
      let resolvedCoverUrl: string | null = null
      if (coverValue instanceof File) {
        resolvedCoverUrl = await uploadCoverImage(coverValue)
      } else if (typeof coverValue === "string") {
        resolvedCoverUrl = coverValue
      }

      const uploadedMedia: NonNullable<CreateCapsulePayload["media"]> = []
      for (const mediaFile of mediaFiles) {
        const uploaded = await uploadCapsuleAttachment(mediaFile.file)
        uploadedMedia.push(uploaded)
      }
      const mergedMedia: NonNullable<CreateCapsulePayload["media"]> = [
        ...existingMedia.map((item) => ({
          id: item.id,
          url: item.url,
          type: item.type,
          meta: item.meta,
        })),
        ...uploadedMedia,
      ]

      const savedCapsule = await onSubmit({
        title: trimmedTitle,
        body: trimmedBody || null,
        visibility,
        status,
        unlockAt: new Date(unlockAt).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        allowComments,
        allowReactions,
        tags: tags.length > 0 ? tags : null,
        coverImageUrl: resolvedCoverUrl,
        media: mergedMedia.length > 0 ? mergedMedia : null,
        location: locationPayload,
      })

      onSubmitted?.(savedCapsule)
      if (!onSubmitted) {
        navigate(isEditMode ? `/capsules/${savedCapsule.id}` : "/account")
      }
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="relative isolate min-h-[calc(100svh-var(--tc-shell-offset,4rem))] overflow-hidden bg-[#0c1f45] px-4 py-5 lg:px-8 lg:py-7">
      <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
        <SpaceBackgroundFrame className="opacity-[0.24] blur-[1px]" restoreSnapshot startSettled />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,20,46,0.56)_0%,rgba(9,18,40,0.68)_58%,rgba(8,16,34,0.8)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(124,92,255,0.18)_0%,rgba(124,92,255,0)_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(94,230,255,0.18)_0%,rgba(94,230,255,0)_40%)]" />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (onCancel ? onCancel() : navigate(-1))}
          className="mb-5 -ml-2 gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-300/28 bg-rose-500/8 p-2">
            <AlertBanner
              type="error"
              message={error.message || (isEditMode ? "Failed to update capsule" : "Failed to create capsule")}
              onDismiss={() => setLocalError(null)}
            />
          </div>
        )}

        <div className="grid gap-6">
          <form onSubmit={handleSubmit} className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section className={sectionCardClass}>
              <p className={sectionTitleClass}>Basic Info</p>
              <h1 className="mt-2 font-serif text-2xl font-semibold text-slate-50">
                {isEditMode ? "Edit Time Capsule" : "Create Time Capsule"}
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                {isEditMode ? "Update your capsule details and save changes." : "Write it today. Reopen it in the future."}
              </p>

              <div className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title" className="text-sm font-medium text-slate-200">
                    Title <span className="text-rose-300">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    placeholder="Give your capsule a name..."
                    className={inputClass}
                    maxLength={200}
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">Max 200 characters</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="body" className="text-sm font-medium text-slate-200">Message</Label>
                  <Textarea
                    id="body"
                    name="body"
                    placeholder="Write your message to the future..."
                    className={textareaClass}
                    maxLength={5000}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">Optional. Max 5000 characters</p>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <p className={sectionTitleClass}>Settings</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-200">
                    Visibility <span className="text-rose-300">*</span>
                  </Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select visibility" /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="private" className={selectItemClass}>
                        <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" />Private</span>
                      </SelectItem>
                      <SelectItem value="public" className={selectItemClass}>
                        <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Public</span>
                      </SelectItem>
                      <SelectItem value="shared" className={selectItemClass}>
                        <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />Shared</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-200">
                    Status <span className="text-rose-300">*</span>
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="draft" className={selectItemClass}>Draft</SelectItem>
                      <SelectItem value="sealed" className={selectItemClass}>Sealed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="unlockAt" className="text-sm font-medium text-slate-200">
                    Unlock Date <span className="text-rose-300">*</span>
                  </Label>
                  <Input
                    id="unlockAt"
                    name="unlockAt"
                    type="datetime-local"
                    className={pickerInputClass}
                    min={status === "sealed" ? minDateString : undefined}
                    max={maxDateString}
                    required
                    value={unlockAt}
                    onChange={(e) => setUnlockAt(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="expiresAt" className="text-sm font-medium text-slate-200">Expires Date</Label>
                  <Input
                    id="expiresAt"
                    name="expiresAt"
                    type="datetime-local"
                    className={pickerInputClass}
                    min={unlockAt || (status === "sealed" ? minDateString : undefined)}
                    max={maxDateString}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">Optional</p>
                </div>
              </div>

              {visibility === "public" && (
                <div className="mt-4 grid gap-3 rounded-xl border border-white/12 bg-white/[0.03] p-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Allow Comments</p>
                      <p className="text-xs text-slate-400">Let others comment on your capsule</p>
                    </div>
                    <Switch className={switchClass} checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Allow Reactions</p>
                      <p className="text-xs text-slate-400">Let others react to your capsule</p>
                    </div>
                    <Switch className={switchClass} checked={allowReactions} onCheckedChange={setAllowReactions} />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/12 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Attach Location</p>
                    <p className="text-xs text-slate-400">Pick a location with map search or current GPS.</p>
                  </div>
                  <Switch
                    className={switchClass}
                    checked={useLocation}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        clearLocation()
                        return
                      }
                      setUseLocation(true)
                      openLocationPicker()
                    }}
                  />
                </div>

                <div className="flex min-h-[62px] flex-col justify-center rounded-lg border border-white/10 bg-[#0a1328]/70 p-3">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {hasValidLocation ? (locationLabel || "Custom location") : "No location selected"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {hasValidLocation
                      ? `Lat ${parsedLat.toFixed(6)}, Lon ${parsedLon.toFixed(6)}`
                      : "Enable location to choose a point on the map"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-white/18 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08] sm:w-auto"
                    onClick={openLocationPicker}
                  >
                    <MapPin className="h-4 w-4" /> {hasValidLocation ? "Edit location" : "Select location"}
                  </Button>
                  {hasValidLocation && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full gap-1.5 text-slate-300 hover:bg-white/[0.08] hover:text-slate-100 sm:w-auto"
                      onClick={clearLocation}
                    >
                      <X className="h-4 w-4" /> Clear
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <p className={sectionTitleClass}>Media</p>
              <div className="mt-4 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-200">Cover Image</Label>
                  <CoverUploader coverValue={coverValue} onCoverChange={setCoverValue} theme="cosmic" />
                  <p className="text-xs text-slate-400">
                    Optional. Shown as thumbnail in capsule lists. Selecting a tag with image can suggest a cover.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-slate-200">Media</Label>
                  {isEditMode && existingMedia.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-xl border border-white/12 bg-white/[0.03] p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-300/85">Existing Media</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {existingMedia.map((item) => {
                          const mediaId = item.id || item.url
                          const preview = resolveAssetUrl(item.thumbnail || item.url)
                          return (
                            <div
                              key={`${mediaId}-${item.url}`}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-white/12 bg-slate-950/55"
                            >
                              {item.type === "video" ? (
                                <video src={preview} className="h-full w-full object-cover" muted playsInline />
                              ) : (
                                <img src={preview} alt={item.alt || "Capsule media"} className="h-full w-full object-cover" />
                              )}
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100" />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => removeExistingMediaItem(mediaId, item.url)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-slate-400">You can remove existing files and add new ones below.</p>
                    </div>
                  )}
                  <MediaUploader files={mediaFiles} onFilesChange={setMediaFiles} theme="cosmic" />
                  <p className="text-xs text-slate-400">
                    Optional. {isEditMode ? "Add more photos or videos to this capsule." : "Add photos or videos to your capsule."}
                  </p>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <p className={sectionTitleClass}>Tags</p>
              <div className="mt-4 flex flex-col gap-4">
                <TagPicker selectedTags={tags} onTagsChange={setTags} onCoverSuggestion={(url) => { if (!coverValue) setCoverValue(url) }} theme="cosmic" />
                <p className="text-xs text-slate-400">
                  Add thematic tags to improve discovery and organize your capsule.
                </p>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 lg:col-span-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-white/18 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                onClick={() => (onCancel ? onCancel() : navigate(-1))}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-12 rounded-xl border border-violet-300/32 bg-[linear-gradient(120deg,rgba(124,92,255,0.86)_0%,rgba(74,120,216,0.82)_100%)] px-6 text-sm font-semibold text-slate-50 shadow-[0_12px_28px_rgba(84,99,229,0.28),0_0_20px_rgba(94,230,255,0.12)] transition-all hover:brightness-105 hover:shadow-[0_16px_34px_rgba(84,99,229,0.34),0_0_24px_rgba(94,230,255,0.16)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Saving changes..." : "Creating capsule..."}
                  </>
                ) : (
                  isEditMode ? "Save Changes" : "Create Capsule"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={locationPickerOpen} onOpenChange={handleLocationPickerOpenChange}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-hidden border border-white/12 bg-[#070f22]/92 p-0 text-slate-100 backdrop-blur-2xl shadow-[0_30px_90px_rgba(2,6,23,0.72)]">
          <DialogHeader className="border-b border-white/10 px-6 pb-4 pt-6">
            <DialogTitle className="font-serif text-xl text-slate-100">Choose Capsule Location</DialogTitle>
            <DialogDescription className="text-slate-300/85">
              Search place name, click map, or use current geolocation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      searchLocation()
                    }
                  }}
                  placeholder="Search city, address, country..."
                  className="h-11 rounded-xl border-white/12 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-400 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-1.5 border-white/14 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                onClick={searchLocation}
                disabled={pickerLoading}
              >
                {pickerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-1.5 border-white/14 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                onClick={useCurrentLocation}
              >
                <LocateFixed className="h-4 w-4" /> Current location
              </Button>
            </div>

            {pickerError && <AlertBanner type="error" message={pickerError} />}

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="overflow-hidden rounded-xl border border-white/12 bg-[#060b18]">
                <div ref={setPickerMapHostEl} className="h-[420px] w-full bg-slate-950" />
              </div>

              <div className="flex h-[420px] flex-col rounded-xl border border-white/12 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-100">Search Results</p>
                  <Crosshair className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {pickerResults.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-slate-400">No results yet. Try searching a place.</p>
                  ) : (
                    <div className="space-y-1">
                      {pickerResults.map((place) => (
                        <button
                          key={String(place.place_id)}
                          type="button"
                          className="w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06]"
                          onClick={() => {
                            const lat = Number(place.lat)
                            const lon = Number(place.lon)
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
                            applyPickerPosition(lat, lon, place.display_name, 10)
                          }}
                        >
                          <p className="line-clamp-2 text-xs text-slate-100">{place.display_name}</p>
                          {place.type && <p className="mt-1 text-[11px] text-slate-400">{place.type}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickerLat" className="text-slate-200">Latitude</Label>
                <Input
                  id="pickerLat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={pickerLat}
                  onChange={(e) => setPickerLat(e.target.value)}
                  className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-slate-100 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickerLon" className="text-slate-200">Longitude</Label>
                <Input
                  id="pickerLon"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={pickerLon}
                  onChange={(e) => setPickerLon(e.target.value)}
                  className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-slate-100 focus-visible:border-violet-300/55 focus-visible:ring-1 focus-visible:ring-violet-300/60"
                />
              </div>
            </div>

            {pickerLabel && <p className="text-xs text-slate-300/90">Selected: {pickerLabel}</p>}
          </div>

          <DialogFooter className="border-t border-white/10 px-6 py-4">
            <Button type="button" variant="ghost" className="text-slate-300 hover:bg-white/[0.08] hover:text-slate-100" onClick={() => setLocationPickerOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" className="border-white/14 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={clearLocation}>
              Clear
            </Button>
            <Button type="button" className="border border-violet-300/26 bg-violet-500/85 text-slate-50 hover:bg-violet-500" onClick={applyLocationFromPicker}>
              Apply location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
