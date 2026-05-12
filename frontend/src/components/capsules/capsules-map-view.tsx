import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Building2, Globe, Loader2, Map as MapIcon, Maximize2, Minimize2, Navigation, Search } from "lucide-react"
import L from "leaflet"
import "leaflet.markercluster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertBanner } from "@/components/alert-banner"
import { listCapsuleMapMarkers, type CapsuleMapMarker } from "@/services/api"
import type { GlobeBuildingsSource } from "./cesium-apple-buildings"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"

type ViewMode = "map" | "globe"
type GlobeImageryStyle = "street" | "satellite"
type CesiumModule = typeof import("cesium")
type MapFocusState = {
  focusCapsuleId?: string
  focusCoordinates?: [number, number]
}

type ClusterPickInfo = {
  __capsuleCluster: true
  capsuleIds: string[]
}

interface CapsulesMapViewProps {
  markersOverride?: CapsuleMapMarker[] | null
  embedded?: boolean
  hideHeader?: boolean
  fromPath?: string
  onOpenCapsule?: (marker: CapsuleMapMarker) => void
  initialSearch?: string
}

const DEFAULT_MAP_CENTER: [number, number] = [26, 12]
const DEFAULT_MAP_ZOOM = 2
const GLOBE_HOME = { lon: 18, lat: 28, height: 21_000_000 }
const GLOBE_MAX_RESOLUTION_SCALE = 2
const GLOBE_MAX_SCREEN_SPACE_ERROR = 2.2
const CAPSULE_ALTITUDE_WITH_BUILDINGS = 14
const CAPSULE_ALTITUDE_WITHOUT_BUILDINGS = 1.8
const OSM_TILE_URL = "/tiles/osm/{z}/{x}/{y}.png"
const CARTO_TILE_URL = "/tiles/carto/{z}/{x}/{y}{r}.png"
const DIRECT_OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const DIRECT_CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
const CESIUM_ION_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim()
const CESIUM_BUILDINGS_TILESET_URL = (import.meta.env.VITE_CESIUM_BUILDINGS_TILESET_URL as string | undefined)?.trim()
const CESIUM_BUILDINGS_ION_ASSET_ID = (import.meta.env.VITE_CESIUM_BUILDINGS_ION_ASSET_ID as string | undefined)?.trim()
const HAS_CUSTOM_BUILDINGS_CONFIG = Boolean(
  CESIUM_BUILDINGS_TILESET_URL || (CESIUM_BUILDINGS_ION_ASSET_ID && /^\d+$/.test(CESIUM_BUILDINGS_ION_ASSET_ID))
)

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

function createPinHtml(isOwn: boolean) {
  const tone = isOwn ? "capsule-pin-own" : "capsule-pin-network"
  return `<div class="capsule-pin ${tone}"><span class="capsule-pin-dot"></span></div>`
}

function createClusterHtml(count: number, hasOwn: boolean) {
  const tone = hasOwn ? "capsule-cluster-own" : "capsule-cluster-network"
  return `<div class="capsule-cluster ${tone}"><span>${count}</span></div>`
}

function isClusterPickInfo(value: unknown): value is ClusterPickInfo {
  if (!value || typeof value !== "object") return false
  const candidate = value as { __capsuleCluster?: unknown; capsuleIds?: unknown }
  return candidate.__capsuleCluster === true && Array.isArray(candidate.capsuleIds)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function makeCesiumPinCanvas(color: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 72
  canvas.height = 72
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  ctx.clearRect(0, 0, 72, 72)

  // Outer halo for readability over terrain/imagery.
  ctx.beginPath()
  ctx.arc(36, 24, 20, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(2, 6, 23, 0.35)"
  ctx.fill()

  // Main head.
  ctx.beginPath()
  ctx.arc(36, 24, 17, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()

  // Tail.
  ctx.beginPath()
  ctx.moveTo(36, 62)
  ctx.lineTo(21, 30)
  ctx.lineTo(51, 30)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(36, 24, 7, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  return canvas
}

function makeCesiumClusterCanvas(count: number, hasOwn: boolean) {
  const canvas = document.createElement("canvas")
  canvas.width = 74
  canvas.height = 74
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const color = hasOwn ? "#6046E7" : "#24C8D8"
  const light = hasOwn ? "#7C5CFF" : "#5EE6FF"
  ctx.clearRect(0, 0, 74, 74)

  ctx.beginPath()
  ctx.arc(37, 37, 30, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(2, 6, 23, 0.36)"
  ctx.fill()

  const gradient = ctx.createRadialGradient(30, 24, 6, 37, 37, 30)
  gradient.addColorStop(0, light)
  gradient.addColorStop(1, color)
  ctx.beginPath()
  ctx.arc(37, 37, 28, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = "rgba(255,255,255,0.95)"
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.font = "700 19px Inter, Arial, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(count), 37, 38)
  return canvas
}

function bindCesiumBaseImagery(viewer: any, Cesium: CesiumModule, style: GlobeImageryStyle) {
  const sources =
    style === "satellite"
      ? [
          {
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 23,
          },
          {
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 23,
          },
          { url: DIRECT_OSM_TILE_URL, maximumLevel: 19 },
        ]
      : [
          { url: OSM_TILE_URL, maximumLevel: 19 },
          { url: DIRECT_OSM_TILE_URL, maximumLevel: 19 },
          { url: CARTO_TILE_URL.replace("{r}", ""), maximumLevel: 20 },
          { url: DIRECT_CARTO_TILE_URL.replace("{r}", ""), maximumLevel: 20, subdomains: ["a", "b", "c", "d"] as string[] },
        ]

  const ERROR_THRESHOLD = 2
  const RETRY_DELAY_MS = 3500
  let sourceIndex = 0
  let errorCount = 0
  let retryTimer: number | null = null
  let activeLayer: any = null
  let detachErrors: (() => void) | null = null

  const clearRetry = () => {
    if (retryTimer != null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const cleanupLayer = () => {
    detachErrors?.()
    detachErrors = null
    if (activeLayer) {
      viewer.imageryLayers.remove(activeLayer, true)
      activeLayer = null
    }
  }

  const scheduleRetry = () => {
    clearRetry()
    retryTimer = window.setTimeout(() => attach(0), RETRY_DELAY_MS)
  }

  const attach = (index: number) => {
    clearRetry()
    cleanupLayer()
    if (index >= sources.length) {
      scheduleRetry()
      return
    }

    sourceIndex = index
    errorCount = 0
    const source = sources[index]
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: source.url,
      maximumLevel: source.maximumLevel,
      subdomains: source.subdomains,
    })

    const onProviderError = () => {
      errorCount += 1
      if (errorCount >= ERROR_THRESHOLD) {
        attach(sourceIndex + 1)
      }
    }

    provider.errorEvent.addEventListener(onProviderError)
    detachErrors = () => provider.errorEvent.removeEventListener(onProviderError)
    activeLayer = viewer.imageryLayers.addImageryProvider(provider)
  }

  attach(0)
  return () => {
    clearRetry()
    cleanupLayer()
  }
}

function bindCesiumReferenceOverlay(viewer: any, Cesium: CesiumModule, style: GlobeImageryStyle) {
  if (style !== "satellite") {
    return () => {}
  }

  const provider = new Cesium.UrlTemplateImageryProvider({
    // Transparent labels + admin boundaries overlay for satellite base.
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    maximumLevel: 21,
  })
  const layer = viewer.imageryLayers.addImageryProvider(provider)
  layer.alpha = 0.95
  return () => {
    if (layer && viewer.imageryLayers.contains(layer)) {
      viewer.imageryLayers.remove(layer, true)
    }
  }
}

export function CapsulesMapView({
  markersOverride = null,
  embedded = false,
  hideHeader = false,
  fromPath = "/map",
  onOpenCapsule,
  initialSearch = "",
}: CapsulesMapViewProps = {}) {
  const [markers, setMarkers] = useState<CapsuleMapMarker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMapInitializing, setIsMapInitializing] = useState(false)
  const [isGlobeInitializing, setIsGlobeInitializing] = useState(false)
  const [globeBuildingsEnabled, setGlobeBuildingsEnabled] = useState(true)
  const [globeBuildingsStatus, setGlobeBuildingsStatus] = useState<"off" | "loading" | "ready" | "unavailable">("off")
  const [globeBuildingsSource, setGlobeBuildingsSource] = useState<GlobeBuildingsSource | "off">("off")
  const [globeImageryStyle, setGlobeImageryStyle] = useState<GlobeImageryStyle>("satellite")
  const [globeTerrainStatus, setGlobeTerrainStatus] = useState<"loading" | "ready" | "unavailable">("loading")
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>("map")
  const [search, setSearch] = useState(initialSearch)
  const [selectedMarker, setSelectedMarker] = useState<CapsuleMapMarker | null>(null)
  const [selectedClusterMarkers, setSelectedClusterMarkers] = useState<CapsuleMapMarker[]>([])
  const [leafletReady, setLeafletReady] = useState(false)
  const [globeReady, setGlobeReady] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [embeddedAutoHeight, setEmbeddedAutoHeight] = useState(420)

  const mapViewportRef = useRef<HTMLDivElement | null>(null)
  const [mapHostEl, setMapHostEl] = useState<HTMLDivElement | null>(null)
  const [globeHostEl, setGlobeHostEl] = useState<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any>(null)
  const leafletClusterLayerRef = useRef<any>(null)

  const cesiumRef = useRef<CesiumModule | null>(null)
  const cesiumViewerRef = useRef<any>(null)
  const cesiumDataSourceRef = useRef<any>(null)
  const cesiumClickHandlerRef = useRef<any>(null)
  const cesiumImageryCleanupRef = useRef<(() => void) | null>(null)
  const cesiumReferenceCleanupRef = useRef<(() => void) | null>(null)
  const cesiumTileLoadCleanupRef = useRef<(() => void) | null>(null)
  const cesiumBuildingsRef = useRef<any>(null)
  const cesiumBuildingsVisibilityCleanupRef = useRef<(() => void) | null>(null)
  const globeBuildingsEnabledRef = useRef(true)
  const globeBuildingsInFlightRef = useRef(false)
  const cesiumEntitiesByIdRef = useRef(new Map<string, CapsuleMapMarker>())
  const didFlyToGlobeDataRef = useRef(false)
  const globeInitInFlightRef = useRef(false)
  const didApplyRequestedFocusRef = useRef(false)

  const navigate = useNavigate()
  const location = useLocation()

  const requestedFocus = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const fromQuery = params.get("capsuleId")?.trim()
    const fromState = (location.state as MapFocusState | null) || null

    const rawCoords = fromState?.focusCoordinates
    const coordsValid =
      Array.isArray(rawCoords) &&
      rawCoords.length === 2 &&
      Number.isFinite(rawCoords[0]) &&
      Number.isFinite(rawCoords[1])

    return {
      capsuleId: fromQuery || fromState?.focusCapsuleId || null,
      coordinates: coordsValid ? (rawCoords as [number, number]) : null,
    }
  }, [location.search, location.state])

  useEffect(() => {
    didApplyRequestedFocusRef.current = false
  }, [requestedFocus.capsuleId, requestedFocus.coordinates?.[0], requestedFocus.coordinates?.[1]])

  useEffect(() => {
    setSearch(initialSearch || "")
  }, [initialSearch])

  useEffect(() => {
    globeBuildingsEnabledRef.current = globeBuildingsEnabled
  }, [globeBuildingsEnabled])

  useEffect(() => {
    if (markersOverride == null) return
    setMarkers(Array.isArray(markersOverride) ? markersOverride : [])
    setError(null)
    setIsLoading(false)
  }, [markersOverride])

  useEffect(() => {
    if (markersOverride != null) return
    let cancelled = false
    setIsLoading(true)
    listCapsuleMapMarkers()
      .then((data) => {
        if (cancelled) return
        setMarkers(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setMarkers([])
        setError(e?.message || "Failed to load map markers")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [markersOverride])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mapViewportRef.current)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!embedded || isFullscreen) return

    const updateEmbeddedHeight = () => {
      const viewportHost = mapViewportRef.current
      if (!viewportHost) return
      const rect = viewportHost.getBoundingClientRect()
      const calculated = Math.max(360, Math.floor(window.innerHeight - rect.top - 18))
      setEmbeddedAutoHeight((previous) => (Math.abs(previous - calculated) > 2 ? calculated : previous))
    }

    updateEmbeddedHeight()
    window.addEventListener("resize", updateEmbeddedHeight)
    window.addEventListener("orientationchange", updateEmbeddedHeight)
    window.addEventListener("scroll", updateEmbeddedHeight, { passive: true })

    return () => {
      window.removeEventListener("resize", updateEmbeddedHeight)
      window.removeEventListener("orientationchange", updateEmbeddedHeight)
      window.removeEventListener("scroll", updateEmbeddedHeight)
    }
  }, [embedded, isFullscreen])

  const filteredMarkers = useMemo(() => {
    const uniqueById = new Map<string, CapsuleMapMarker>()
    for (const marker of markers) {
      if (!marker?.id) continue
      if (!uniqueById.has(marker.id)) uniqueById.set(marker.id, marker)
    }

    const q = search.trim().toLowerCase()
    const uniqueMarkers = Array.from(uniqueById.values())
    if (!q) return uniqueMarkers
    return uniqueMarkers.filter((m) => {
      const source = `${m.title || ""} ${m.ownerName || ""} ${(m.tags || []).join(" ")}`
      return source.toLowerCase().includes(q)
    })
  }, [markers, search])

  useEffect(() => {
    if (mode !== "map") return
    if (!mapHostEl) return
    if (leafletMapRef.current) return

    setIsMapInitializing(true)
    const container = mapHostEl as any
    if (container?._leaflet_id) {
      try { delete container._leaflet_id } catch {}
      try { container._leaflet_id = undefined } catch {}
    }

    const map = L.map(container, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      minZoom: 2,
      maxZoom: 19,
      worldCopyJump: true,
      zoomControl: false,
      preferCanvas: true,
    })
    const removeTileLayer = bindFreeTileLayer(map)

    const clusterLayer = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 10,
      maxClusterRadius: 42,
      iconCreateFunction: (cluster: any) => {
        const items = cluster.getAllChildMarkers() as any[]
        const count = cluster.getChildCount()
        const hasOwn = items.some((marker) => marker?.options?.capsuleOwn === true)
        return L.divIcon({
          html: createClusterHtml(count, hasOwn),
          className: "capsule-leaflet-cluster-wrapper",
          iconSize: [62, 62],
        })
      },
    })

    map.addLayer(clusterLayer)
    map.on("click", () => {
      setSelectedMarker(null)
      setSelectedClusterMarkers([])
    })
    leafletMapRef.current = map
    leafletClusterLayerRef.current = clusterLayer
    setLeafletReady(true)
    setIsMapInitializing(false)
    const stopLayoutForce = forceLeafletLayout(map)

    return () => {
      stopLayoutForce()
      removeTileLayer()
      map.remove()
      leafletMapRef.current = null
      leafletClusterLayerRef.current = null
      setLeafletReady(false)
      setIsMapInitializing(false)
    }
  }, [mode, mapHostEl])

  useEffect(() => {
    const map = leafletMapRef.current
    const clusterLayer = leafletClusterLayerRef.current
    if (!map || !clusterLayer || !leafletReady) return

    clusterLayer.clearLayers()
    const markersById = new Map<string, CapsuleMapMarker>()
    for (const marker of filteredMarkers) {
      const lon = marker.coordinates?.[0]
      const lat = marker.coordinates?.[1]
      if (typeof lon !== "number" || typeof lat !== "number") continue
      markersById.set(marker.id, marker)

      const leafletMarker = L.marker([lat, lon], {
        icon: L.divIcon({
          html: createPinHtml(marker.isOwn),
          className: "capsule-leaflet-marker-wrapper",
          iconSize: [44, 44],
          iconAnchor: [22, 38],
          popupAnchor: [0, -28],
        }),
        zIndexOffset: 1200,
        capsuleOwn: marker.isOwn,
        capsuleId: marker.id,
      } as any)

      const tags = (marker.tags || []).slice(0, 3).join(", ")
      leafletMarker.bindPopup(
        `<div style="min-width:180px;font-family:Inter,Arial,sans-serif">
          <div style="font-weight:700;margin-bottom:4px">${marker.title || "Untitled"}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px">${marker.ownerName || "Unknown"}</div>
          ${tags ? `<div style="font-size:11px;color:#0f766e">${tags}</div>` : ""}
        </div>`,
        { closeButton: false, offset: [0, -20] }
      )
      leafletMarker.on("click", () => {
        setSelectedClusterMarkers([])
        setSelectedMarker(marker)
      })
      clusterLayer.addLayer(leafletMarker)
    }

    clusterLayer.off("clusterclick")
    clusterLayer.on("clusterclick", (event: any) => {
      if (event?.originalEvent) {
        L.DomEvent.stop(event.originalEvent)
      }
      const childMarkers = (event?.layer?.getAllChildMarkers?.() || []) as any[]
      if (!childMarkers.length) return
      const clusterMembers = childMarkers
        .map((child) => markersById.get(String(child?.options?.capsuleId || "")))
        .filter((member): member is CapsuleMapMarker => Boolean(member))
      if (!clusterMembers.length) return
      setSelectedMarker(null)
      setSelectedClusterMarkers(clusterMembers)
    })

    if (!didApplyRequestedFocusRef.current) {
      const focusMarker = requestedFocus.capsuleId ? markersById.get(requestedFocus.capsuleId) : null
      if (focusMarker) {
        const lon = focusMarker.coordinates[0]
        const lat = focusMarker.coordinates[1]
        map.setView([lat, lon], 10, { animate: false })
        setSelectedClusterMarkers([])
        setSelectedMarker(focusMarker)
        didApplyRequestedFocusRef.current = true
        return
      }
      if (requestedFocus.coordinates) {
        const lon = requestedFocus.coordinates[0]
        const lat = requestedFocus.coordinates[1]
        map.setView([lat, lon], 10, { animate: false })
        didApplyRequestedFocusRef.current = true
        return
      }
    }

    if (filteredMarkers.length > 0) {
      const bounds = L.latLngBounds(
        filteredMarkers
          .filter((m) => typeof m.coordinates?.[0] === "number" && typeof m.coordinates?.[1] === "number")
          .map((m) => [m.coordinates[1], m.coordinates[0]])
      )
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 6, animate: false })
      }
    } else {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: false })
    }
  }, [filteredMarkers, leafletReady, requestedFocus.capsuleId, requestedFocus.coordinates])

  useEffect(() => {
    if (mode !== "map") return
    const map = leafletMapRef.current
    if (!map) return
    const stopLayoutForce = forceLeafletLayout(map)
    return () => stopLayoutForce()
  }, [mode])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (mode === "map") {
        leafletMapRef.current?.invalidateSize?.(true)
        return
      }
      const viewer = cesiumViewerRef.current
      viewer?.resize?.()
      viewer?.scene?.requestRender?.()
    }, 90)
    return () => window.clearTimeout(t)
  }, [isFullscreen, mode, leafletReady, globeReady])

  useEffect(() => {
    let disposed = false
    if (mode !== "globe") return
    if (!globeHostEl) return
    if (cesiumViewerRef.current || globeInitInFlightRef.current) return

    ;(async () => {
      globeInitInFlightRef.current = true
      setIsGlobeInitializing(true)
      try {
        const [{ default: _unusedCss }, Cesium] = await Promise.all([
          import("cesium/Build/Cesium/Widgets/widgets.css"),
          import("cesium"),
        ])
        void _unusedCss
        if (disposed) return
        cesiumRef.current = Cesium
        if (CESIUM_ION_TOKEN) {
          Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN
        }

        const viewer = new Cesium.Viewer(globeHostEl, {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
          shouldAnimate: false,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        })

        viewer.imageryLayers.removeAll()
        cesiumImageryCleanupRef.current?.()
        cesiumReferenceCleanupRef.current?.()
        cesiumTileLoadCleanupRef.current?.()
        cesiumTileLoadCleanupRef.current = null
        cesiumImageryCleanupRef.current = bindCesiumBaseImagery(viewer, Cesium, globeImageryStyle)
        cesiumReferenceCleanupRef.current = bindCesiumReferenceOverlay(viewer, Cesium, globeImageryStyle)
        const onTileLoadProgress = (_remainingTiles: number) => {
          viewer.scene.requestRender()
        }
        viewer.scene.globe.tileLoadProgressEvent.addEventListener(onTileLoadProgress)
        cesiumTileLoadCleanupRef.current = () => {
          viewer.scene.globe.tileLoadProgressEvent.removeEventListener(onTileLoadProgress)
        }

        viewer.shadows = false
        if (viewer.scene.shadowMap) {
          viewer.scene.shadowMap.enabled = false
        }
        viewer.scene.requestRenderMode = true
        viewer.scene.maximumRenderTimeChange = Infinity
        viewer.resolutionScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), GLOBE_MAX_RESOLUTION_SCALE)
        ;(viewer.scene as any).fxaa = false
        viewer.scene.postProcessStages.fxaa.enabled = false
        viewer.scene.fog.enabled = false
        viewer.scene.globe.enableLighting = false
        viewer.scene.globe.depthTestAgainstTerrain = true
        viewer.scene.globe.maximumScreenSpaceError = GLOBE_MAX_SCREEN_SPACE_ERROR
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#172235")
        viewer.scene.skyAtmosphere.show = true

        const dataSource = new Cesium.CustomDataSource("capsule-markers")
        dataSource.clustering.enabled = true
        dataSource.clustering.pixelRange = 44
        dataSource.clustering.minimumClusterSize = 2
        dataSource.clustering.clusterEvent.addEventListener((clusteredEntities: any[], cluster: any) => {
          const capsuleIds = Array.from(
            new Set(
              clusteredEntities
                .map((entity) => String(entity?.properties?.capsuleId?.getValue?.() || ""))
                .filter((id) => id.length > 0)
            )
          )
          const hasOwn = clusteredEntities.some((entity) => entity.properties?.isOwn?.getValue?.() === true)
          const clusterPickInfo: ClusterPickInfo = {
            __capsuleCluster: true,
            capsuleIds,
          }
          cluster.billboard.show = true
          cluster.billboard.image = makeCesiumClusterCanvas(clusteredEntities.length, hasOwn)
          cluster.billboard.width = 62
          cluster.billboard.height = 62
          cluster.billboard.heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND
          cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
          cluster.billboard.id = clusterPickInfo
          cluster.label.show = false
          cluster.label.id = clusterPickInfo
          cluster.point.show = false
          cluster.point.id = clusterPickInfo
        })

        await viewer.dataSources.add(dataSource)
        cesiumDataSourceRef.current = dataSource
        cesiumViewerRef.current = viewer

        const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        clickHandler.setInputAction((click: any) => {
          const picked = viewer.scene.pick(click.position)
          if (!Cesium.defined(picked) || !picked?.id) {
            setSelectedMarker(null)
            setSelectedClusterMarkers([])
            return
          }

          const pickedId = picked.id
          if (isClusterPickInfo(pickedId)) {
            const clusterMembers = pickedId.capsuleIds
              .map((id) => cesiumEntitiesByIdRef.current.get(String(id)))
              .filter((member): member is CapsuleMapMarker => Boolean(member))
            setSelectedMarker(null)
            setSelectedClusterMarkers(clusterMembers)
            return
          }

          const capsuleId = pickedId?.properties?.capsuleId?.getValue?.()
          if (!capsuleId) {
            setSelectedMarker(null)
            setSelectedClusterMarkers([])
            return
          }
          const marker = cesiumEntitiesByIdRef.current.get(String(capsuleId))
          if (!marker) {
            setSelectedMarker(null)
            setSelectedClusterMarkers([])
            return
          }
          setSelectedClusterMarkers([])
          setSelectedMarker(marker)
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        cesiumClickHandlerRef.current = clickHandler

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(GLOBE_HOME.lon, GLOBE_HOME.lat, GLOBE_HOME.height),
        })
        setGlobeReady(true)
      } catch (e: any) {
        if (!disposed) setError(e?.message || "Failed to initialize globe")
      } finally {
        if (!disposed) setIsGlobeInitializing(false)
        globeInitInFlightRef.current = false
      }
    })()

    return () => {
      disposed = true
    }
  }, [mode, globeHostEl])

  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = cesiumViewerRef.current
    if (!Cesium || !viewer || mode !== "globe") return
    cesiumImageryCleanupRef.current?.()
    cesiumReferenceCleanupRef.current?.()
    cesiumImageryCleanupRef.current = bindCesiumBaseImagery(viewer, Cesium, globeImageryStyle)
    cesiumReferenceCleanupRef.current = bindCesiumReferenceOverlay(viewer, Cesium, globeImageryStyle)
    viewer.scene.requestRender()
  }, [mode, globeReady, globeImageryStyle])

  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = cesiumViewerRef.current
    if (!Cesium || !viewer || mode !== "globe" || !globeReady) return

    let disposed = false
    setGlobeTerrainStatus("loading")

    ;(async () => {
      try {
        const provider = await Cesium.createWorldTerrainAsync({
          requestVertexNormals: false,
          requestWaterMask: false,
        })

        if (disposed) return
        viewer.terrainProvider = provider
        viewer.scene.globe.depthTestAgainstTerrain = true
        setGlobeTerrainStatus("ready")
      } catch {
        if (disposed) return
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
        viewer.scene.globe.depthTestAgainstTerrain = true
        setGlobeTerrainStatus("unavailable")
      } finally {
        if (!disposed) {
          viewer.scene.requestRender()
        }
      }
    })()

    return () => {
      disposed = true
    }
  }, [mode, globeReady])

  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = cesiumViewerRef.current
    if (!Cesium || !viewer || !globeReady || mode !== "globe") return

    let disposed = false

    const removeBuildings = () => {
      cesiumBuildingsVisibilityCleanupRef.current?.()
      cesiumBuildingsVisibilityCleanupRef.current = null
      if (!cesiumBuildingsRef.current) return
      viewer.scene.primitives.remove(cesiumBuildingsRef.current)
      cesiumBuildingsRef.current = null
      setGlobeBuildingsSource("off")
      viewer.scene.requestRender()
    }

    if (!globeBuildingsEnabled) {
      removeBuildings()
      setGlobeBuildingsStatus("off")
      setGlobeBuildingsSource("off")
      return
    }

    if (cesiumBuildingsRef.current) {
      setGlobeBuildingsStatus("ready")
      return
    }

    if (globeBuildingsInFlightRef.current) return

    globeBuildingsInFlightRef.current = true
    setGlobeBuildingsStatus("loading")

    ;(async () => {
      try {
        const { createAppleLikeBuildingsTileset } = await import("./cesium-apple-buildings")
        const { tileset, source } = await withTimeout(
          createAppleLikeBuildingsTileset(Cesium),
          12_000,
          "3D buildings request timed out"
        )
        if (disposed || !globeBuildingsEnabledRef.current) {
          tileset.destroy?.()
          return
        }
        viewer.scene.primitives.add(tileset)
        cesiumBuildingsRef.current = tileset
        setGlobeBuildingsSource(source)
        tileset.show = true

        setGlobeBuildingsStatus("ready")
        viewer.scene.requestRender()
      } catch {
        if (!disposed) {
          setGlobeBuildingsStatus("unavailable")
          setGlobeBuildingsSource("off")
        }
      } finally {
        globeBuildingsInFlightRef.current = false
      }
    })()

    return () => {
      disposed = true
    }
  }, [mode, globeReady, globeBuildingsEnabled])

  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = cesiumViewerRef.current
    const dataSource = cesiumDataSourceRef.current
    if (!Cesium || !viewer || !dataSource || !globeReady) return

    dataSource.entities.removeAll()
    cesiumEntitiesByIdRef.current.clear()
    const ownPin = makeCesiumPinCanvas("#7C5CFF")
    const netPin = makeCesiumPinCanvas("#5EE6FF")
    const markerAltitude = globeBuildingsEnabled ? CAPSULE_ALTITUDE_WITH_BUILDINGS : CAPSULE_ALTITUDE_WITHOUT_BUILDINGS
    const markerOffsetY = globeBuildingsEnabled ? -8 : -6

    for (const marker of filteredMarkers) {
      const lon = marker.coordinates?.[0]
      const lat = marker.coordinates?.[1]
      if (typeof lon !== "number" || typeof lat !== "number") continue

      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, markerAltitude),
        billboard: {
          image: marker.isOwn ? ownPin : netPin,
          width: 44,
          height: 44,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          pixelOffset: new Cesium.Cartesian2(0, markerOffsetY),
          scaleByDistance: new Cesium.NearFarScalar(80_000, 1.18, 13_000_000, 0.72),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          capsuleId: marker.id,
          isOwn: marker.isOwn,
        },
      })
      cesiumEntitiesByIdRef.current.set(marker.id, marker)
    }

    if (!didApplyRequestedFocusRef.current) {
      const focusMarker = requestedFocus.capsuleId ? cesiumEntitiesByIdRef.current.get(requestedFocus.capsuleId) : null
      if (focusMarker) {
        const lon = focusMarker.coordinates[0]
        const lat = focusMarker.coordinates[1]
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1_200_000),
          duration: 1.0,
        })
        setSelectedClusterMarkers([])
        setSelectedMarker(focusMarker)
        didApplyRequestedFocusRef.current = true
        viewer.scene.requestRender()
        return
      }
      if (requestedFocus.coordinates) {
        const lon = requestedFocus.coordinates[0]
        const lat = requestedFocus.coordinates[1]
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1_200_000),
          duration: 1.0,
        })
        didApplyRequestedFocusRef.current = true
        viewer.scene.requestRender()
        return
      }
    }

    if (filteredMarkers.length > 0 && !didFlyToGlobeDataRef.current) {
      viewer.flyTo(dataSource, { duration: 1.2, offset: new Cesium.HeadingPitchRange(0, -0.8, 4_500_000) })
      didFlyToGlobeDataRef.current = true
    }
    viewer.scene.requestRender()
  }, [filteredMarkers, globeReady, globeTerrainStatus, globeBuildingsEnabled, requestedFocus.capsuleId, requestedFocus.coordinates])

  useEffect(() => {
    return () => {
      const viewer = cesiumViewerRef.current
      cesiumBuildingsVisibilityCleanupRef.current?.()
      cesiumBuildingsVisibilityCleanupRef.current = null
      if (viewer && cesiumBuildingsRef.current) {
        viewer.scene.primitives.remove(cesiumBuildingsRef.current)
      }
      cesiumBuildingsRef.current = null
      globeBuildingsInFlightRef.current = false
      cesiumImageryCleanupRef.current?.()
      cesiumImageryCleanupRef.current = null
      cesiumReferenceCleanupRef.current?.()
      cesiumReferenceCleanupRef.current = null
      cesiumTileLoadCleanupRef.current?.()
      cesiumTileLoadCleanupRef.current = null
      cesiumClickHandlerRef.current?.destroy?.()
      cesiumClickHandlerRef.current = null
      cesiumViewerRef.current?.destroy?.()
      cesiumViewerRef.current = null
      cesiumDataSourceRef.current = null
      setGlobeReady(false)
      setGlobeBuildingsStatus("off")
      setGlobeBuildingsSource("off")
    }
  }, [])

  useEffect(() => {
    setSelectedMarker(null)
    setSelectedClusterMarkers([])
  }, [mode, search])

  const resetView = () => {
    if (mode === "map") {
      const map = leafletMapRef.current
      if (!map) return
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: true })
      return
    }
    const viewer = cesiumViewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(GLOBE_HOME.lon, GLOBE_HOME.lat, GLOBE_HOME.height),
      duration: 1.1,
    })
  }

  const openCapsule = (marker: CapsuleMapMarker) => {
    if (onOpenCapsule) {
      onOpenCapsule(marker)
      return
    }
    navigate(`/capsules/${marker.id}`, { state: { from: fromPath } })
  }

  const toggleFullscreen = async () => {
    const host = mapViewportRef.current
    if (!host) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await host.requestFullscreen()
      }
    } catch {
      // Ignore browser fullscreen errors (permissions/unsupported environments).
    }
  }

  const showInitOverlay = mode === "map" ? isMapInitializing : isGlobeInitializing
  const buildingsBusy = globeBuildingsStatus === "loading"
  const terrainHint =
    globeTerrainStatus === "ready"
      ? "Terrain: Cesium World Terrain"
      : globeTerrainStatus === "loading"
      ? "Terrain: loading..."
      : "Terrain unavailable (check Cesium token/network)"
  const buildingsHint =
    globeBuildingsStatus === "ready"
      ? globeBuildingsSource === "custom"
        ? "3D buildings: enabled (custom 3D Tiles, Apple-like mode)"
        : "3D buildings: enabled (OSM fallback)"
      : globeBuildingsStatus === "loading"
      ? "3D buildings: loading..."
      : globeBuildingsStatus === "unavailable"
      ? HAS_CUSTOM_BUILDINGS_CONFIG
        ? "3D buildings unavailable (custom tileset + OSM failed)"
        : "3D buildings unavailable (OSM failed, set VITE_CESIUM_BUILDINGS_TILESET_URL)"
      : "3D buildings: off"
  const selectedClusterItems = useMemo(() => {
    if (!selectedClusterMarkers.length) return []
    const uniqueById = new Map<string, CapsuleMapMarker>()
    for (const marker of selectedClusterMarkers) {
      if (!marker?.id || uniqueById.has(marker.id)) continue
      uniqueById.set(marker.id, marker)
    }
    return Array.from(uniqueById.values()).sort((a, b) => {
      if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1
      return (a.title || "").localeCompare(b.title || "")
    })
  }, [selectedClusterMarkers])
  const searchPlaceholder =
    markersOverride != null ? "Filter by title or tag..." : "Filter by title, owner, tag..."
  const viewportHeight = isFullscreen ? "100vh" : embedded ? `${embeddedAutoHeight}px` : "620px"
  const showLegend = !embedded

  return (
    <div className={embedded ? "flex w-full flex-1 flex-col" : "mx-auto max-w-7xl px-4 py-8 lg:px-8"}>
      {!embedded && (
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-5 -ml-3 gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      )}

      {!hideHeader && (
        <div className="mb-4">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">Capsule Atlas</h1>
          <p className="text-sm text-muted-foreground">2D map + 3D globe for your capsule locations.</p>
        </div>
      )}

      {error && <AlertBanner type="error" message={error} />}

      <div
        ref={mapViewportRef}
        className={`relative overflow-hidden border border-white/14 bg-slate-900 shadow-sm ${
          isFullscreen ? "rounded-none" : "rounded-2xl"
        } ${embedded ? "min-h-[360px] flex-1" : ""}`}
        style={{ height: viewportHeight }}
      >
        <div ref={setMapHostEl} className={`absolute inset-0 ${mode === "map" ? "block" : "hidden"}`} />
        <div ref={setGlobeHostEl} className={`absolute inset-0 ${mode === "globe" ? "block" : "hidden"}`} />

        <div
          className={
            embedded
              ? "absolute left-3 top-3 z-[700] flex flex-col gap-2"
              : "absolute left-3 top-3 z-[700] flex w-[min(92vw,360px)] flex-col gap-2"
          }
          style={embedded ? { width: "clamp(160px, calc(100% - 176px), 360px)" } : undefined}
        >
          <div className="flex items-center gap-1 rounded-xl border border-cyan-200/25 bg-slate-950/74 p-1 backdrop-blur-md">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${mode === "map" ? "border border-cyan-300/35 bg-cyan-300/16 text-cyan-100 hover:bg-cyan-300/24" : "text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"}`}
              onClick={() => setMode("map")}
            >
              <MapIcon className="h-4 w-4" /> Map
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${mode === "globe" ? "border border-violet-300/40 bg-violet-400/18 text-violet-100 hover:bg-violet-400/24" : "text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"}`}
              onClick={() => setMode("globe")}
            >
              <Globe className="h-4 w-4" /> Globe
            </Button>
          </div>

          <div className="relative rounded-xl border border-cyan-200/25 bg-slate-950/74 p-2 backdrop-blur-md">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 border-cyan-200/22 bg-[#030816]/88 pl-9 text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/30"
            />
          </div>
        </div>

        <div className="absolute right-3 top-3 z-[700] flex flex-col gap-2">
          <div className="flex flex-col gap-1 rounded-xl border border-cyan-200/25 bg-slate-950/74 p-1 backdrop-blur-md">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-200 hover:bg-white/[0.08] hover:text-slate-50" onClick={resetView}>
              <Navigation className="h-4 w-4" /> Reset
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-200 hover:bg-white/[0.08] hover:text-slate-50" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? "Exit full" : "Full screen"}
            </Button>
          </div>

          {mode === "globe" && (
            <div className="flex flex-col gap-1 rounded-xl border border-violet-200/25 bg-slate-950/74 p-1 backdrop-blur-md">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 ${globeImageryStyle === "satellite" ? "border border-violet-300/40 bg-violet-400/18 text-violet-100 hover:bg-violet-400/24" : "text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"}`}
                onClick={() => setGlobeImageryStyle((prev) => (prev === "satellite" ? "street" : "satellite"))}
                disabled={isGlobeInitializing}
              >
                {globeImageryStyle === "satellite" ? "Satellite" : "Street"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 ${globeBuildingsEnabled ? "border border-cyan-300/35 bg-cyan-300/16 text-cyan-100 hover:bg-cyan-300/24" : "text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"}`}
                onClick={() => setGlobeBuildingsEnabled((prev) => !prev)}
                disabled={buildingsBusy || isGlobeInitializing}
              >
                {buildingsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {globeBuildingsEnabled ? "Buildings on" : "Buildings off"}
              </Button>
            </div>
          )}
        </div>

        {(selectedMarker || selectedClusterItems.length > 0) && (
          <div className="absolute bottom-3 left-3 z-[710] w-[min(92vw,430px)] rounded-2xl border border-slate-300/35 bg-slate-950/82 p-3 text-slate-100 shadow-xl backdrop-blur-md">
            {selectedMarker ? (
              <div className="space-y-2">
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-semibold">{selectedMarker.title || "Untitled capsule"}</p>
                  <p className="truncate text-xs text-slate-300">
                    by {selectedMarker.ownerName || "Unknown"} - {selectedMarker.isOwn ? "your capsule" : "network capsule"}
                  </p>
                  {!!selectedMarker.tags?.length && (
                    <p className="mt-1 text-[11px] text-emerald-300">{(selectedMarker.tags || []).slice(0, 4).join(" - ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMarker(null)}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={() => openCapsule(selectedMarker)}>
                    Open capsule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Capsules in this area ({selectedClusterItems.length})</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClusterMarkers([])}>
                    Dismiss
                  </Button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {selectedClusterItems.map((marker) => (
                    <div key={marker.id} className="rounded-lg border border-slate-700/80 bg-slate-900/65 p-2">
                      <p className="truncate text-sm font-medium">{marker.title || "Untitled capsule"}</p>
                      <p className="truncate text-[11px] text-slate-300">
                        by {marker.ownerName || "Unknown"} - {marker.isOwn ? "your capsule" : "network capsule"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedClusterMarkers([]); setSelectedMarker(marker) }}>
                          Preview
                        </Button>
                        <Button size="sm" onClick={() => openCapsule(marker)}>
                          Open
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(isLoading || showInitOverlay) && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-900/85 px-4 py-2 text-sm text-slate-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isLoading ? "Loading markers..." : mode === "map" ? "Initializing map..." : "Initializing globe..."}
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Your capsules
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" /> Public network capsules
          </span>
          {mode === "globe" && <span>{terrainHint}</span>}
          {mode === "globe" && <span>{buildingsHint}</span>}
        </div>
      )}
    </div>
  )
}
