import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Crosshair, Globe, Link2, Loader2, Lock, LocateFixed, MapPin, Search, X } from "lucide-react"
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
import { uploadCoverImage, uploadMedia } from "@/services/api"
import type { ApiError, Capsule, CreateCapsulePayload } from "@/services/api"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

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
}

const PICKER_DEFAULT_CENTER: [number, number] = [26, 12]
const PICKER_DEFAULT_ZOOM = 2
const OSM_TILE_URL = "/tiles/osm/{z}/{x}/{y}.png"
const CARTO_TILE_URL = "/tiles/carto/{z}/{x}/{y}{r}.png"
const DIRECT_OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const DIRECT_CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"

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

export function CreateCapsuleForm({ onSubmit, onCancel, error: parentError }: CreateCapsuleFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [coverValue, setCoverValue] = useState<File | string | null>(null)
  const [visibility, setVisibility] = useState("private")
  const [status, setStatus] = useState("sealed")
  const [allowComments, setAllowComments] = useState(true)
  const [allowReactions, setAllowReactions] = useState(true)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])

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
    if (visibility !== "public") {
      setAllowComments(false)
      setAllowReactions(false)
    } else {
      setAllowComments(true)
      setAllowReactions(true)
    }
  }, [visibility])

  const error = parentError || localError

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 1)
  const maxDate = new Date("2100-12-31T23:59")
  const minDateString = minDate.toISOString().slice(0, 16)
  const maxDateString = maxDate.toISOString().slice(0, 16)

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
    const fd = new FormData(e.currentTarget)
    const title = fd.get("title")?.toString().trim() || ""
    const body = fd.get("body")?.toString().trim() || ""
    const unlockAt = fd.get("unlockAt")?.toString() || ""
    const expiresAt = fd.get("expiresAt")?.toString() || ""

    if (!title) {
      setLocalError({ status: 0, message: "Title is required" })
      return
    }
    if (!unlockAt) {
      setLocalError({ status: 0, message: "Unlock date is required" })
      return
    }

    const unlockDate = new Date(unlockAt)
    const now = new Date()

    if (unlockDate <= now) {
      setLocalError({ status: 0, message: "Unlock date must be in the future" })
      return
    }
    if (unlockDate.getFullYear() > 2100) {
      setLocalError({ status: 0, message: "Unlock year cannot exceed 2100" })
      return
    }
    if (unlockDate.getFullYear() < now.getFullYear()) {
      setLocalError({ status: 0, message: "Invalid unlock date" })
      return
    }

    if (expiresAt) {
      const expiresDate = new Date(expiresAt)
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

      const created = await onSubmit({
        title,
        body: body || null,
        visibility,
        status,
        unlockAt: new Date(unlockAt).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        allowComments,
        allowReactions,
        tags: tags.length > 0 ? tags : null,
        coverImageUrl: resolvedCoverUrl,
        media: null,
        location: locationPayload,
      })

      if (mediaFiles.length > 0) {
        for (const mediaFile of mediaFiles) {
          await uploadMedia(created.id, mediaFile.file)
        }
      }

      navigate("/capsules")
    } catch (err: any) {
      setLocalError(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => (onCancel ? onCancel() : navigate(-1))} className="mb-6 -ml-3 gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-2 font-serif text-2xl font-bold tracking-tight text-card-foreground">Create Time Capsule</h1>
        <p className="mb-6 text-sm text-muted-foreground">Fill in the details below to create your capsule.</p>

        {error && <AlertBanner type="error" message={error.message || "Failed to create capsule"} onDismiss={() => setLocalError(null)} />}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="title" name="title" type="text" placeholder="Give your capsule a name..." className="h-11" maxLength={200} required />
            <p className="text-xs text-muted-foreground">Max 200 characters</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="body" className="text-sm font-medium">Message</Label>
            <Textarea id="body" name="body" placeholder="Write your message to the future..." className="min-h-[140px] resize-y" maxLength={5000} />
            <p className="text-xs text-muted-foreground">Optional. Max 5000 characters</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">
                Visibility <span className="text-destructive">*</span>
              </Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select visibility" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" />Private</span>
                  </SelectItem>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Public</span>
                  </SelectItem>
                  <SelectItem value="shared">
                    <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />Shared</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sealed">Sealed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="unlockAt" className="text-sm font-medium">
                Unlock Date <span className="text-destructive">*</span>
              </Label>
              <Input id="unlockAt" name="unlockAt" type="datetime-local" className="h-11" min={minDateString} max={maxDateString} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiresAt" className="text-sm font-medium">Expires Date</Label>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" className="h-11" min={minDateString} max={maxDateString} />
              <p className="text-xs text-muted-foreground">Optional</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Cover Image</Label>
            <CoverUploader coverValue={coverValue} onCoverChange={setCoverValue} />
            <p className="text-xs text-muted-foreground">
              Optional. Shown as thumbnail in capsule lists. Selecting a tag with image will suggest it as cover.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Media</Label>
            <MediaUploader files={mediaFiles} onFilesChange={setMediaFiles} />
            <p className="text-xs text-muted-foreground">Optional. Add photos or videos to your capsule.</p>
          </div>

          <TagPicker selectedTags={tags} onTagsChange={setTags} onCoverSuggestion={(url) => { if (!coverValue) setCoverValue(url) }} />

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Attach Location</p>
                <p className="text-xs text-muted-foreground">Pick location in a separate map dialog with search or current GPS.</p>
              </div>
              <Switch
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

            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              {hasValidLocation ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{locationLabel || "Custom location"}</p>
                  <p className="text-xs text-muted-foreground">
                    Lat {parsedLat.toFixed(6)}, Lon {parsedLon.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No location selected yet.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openLocationPicker}>
                <MapPin className="h-4 w-4" /> {hasValidLocation ? "Edit location" : "Select location"}
              </Button>
              {hasValidLocation && (
                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={clearLocation}>
                  <X className="h-4 w-4" /> Clear
                </Button>
              )}
            </div>
          </div>

          {visibility === "public" && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Allow Comments</p>
                  <p className="text-xs text-muted-foreground">Let others comment on your capsule</p>
                </div>
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Allow Reactions</p>
                  <p className="text-xs text-muted-foreground">Let others react to your capsule</p>
                </div>
                <Switch checked={allowReactions} onCheckedChange={setAllowReactions} />
              </div>
            </div>
          )}

          <Button type="submit" className="h-12 w-full text-sm font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating capsule...
              </>
            ) : (
              "Create Capsule"
            )}
          </Button>
        </form>
      </div>

      <Dialog open={locationPickerOpen} onOpenChange={handleLocationPickerOpenChange}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
            <DialogTitle className="font-serif text-xl">Choose Capsule Location</DialogTitle>
            <DialogDescription>
              Search place name (Nominatim), click map, or use current geolocation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" className="gap-1.5" onClick={searchLocation} disabled={pickerLoading}>
                {pickerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={useCurrentLocation}>
                <LocateFixed className="h-4 w-4" /> Current location
              </Button>
            </div>

            {pickerError && <AlertBanner type="error" message={pickerError} />}

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="overflow-hidden rounded-xl border border-border">
                <div ref={setPickerMapHostEl} className="h-[420px] w-full bg-slate-900" />
              </div>

              <div className="flex h-[420px] flex-col rounded-xl border border-border bg-card/40">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-sm font-medium">Search Results</p>
                  <Crosshair className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {pickerResults.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">No results yet. Try searching a place.</p>
                  ) : (
                    <div className="space-y-1">
                      {pickerResults.map((place) => (
                        <button
                          key={String(place.place_id)}
                          type="button"
                          className="w-full rounded-md border border-transparent px-2 py-2 text-left hover:border-border hover:bg-muted/40"
                          onClick={() => {
                            const lat = Number(place.lat)
                            const lon = Number(place.lon)
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
                            applyPickerPosition(lat, lon, place.display_name, 10)
                          }}
                        >
                          <p className="line-clamp-2 text-xs text-foreground">{place.display_name}</p>
                          {place.type && <p className="mt-1 text-[11px] text-muted-foreground">{place.type}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickerLat">Latitude</Label>
                <Input
                  id="pickerLat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={pickerLat}
                  onChange={(e) => setPickerLat(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pickerLon">Longitude</Label>
                <Input
                  id="pickerLon"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={pickerLon}
                  onChange={(e) => setPickerLon(e.target.value)}
                />
              </div>
            </div>

            {pickerLabel && <p className="text-xs text-muted-foreground">Selected: {pickerLabel}</p>}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setLocationPickerOpen(false)}>Cancel</Button>
            <Button type="button" variant="outline" onClick={clearLocation}>Clear</Button>
            <Button type="button" onClick={applyLocationFromPicker}>Apply location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
