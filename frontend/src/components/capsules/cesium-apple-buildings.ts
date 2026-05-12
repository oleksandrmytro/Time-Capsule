type CesiumModule = typeof import("cesium")

export type GlobeBuildingsSource = "custom" | "osm"

export const BUILDINGS_SHOW_HEIGHT = 180_000
export const BUILDINGS_HIDE_HEIGHT = 260_000

const OSM_BUILDINGS_COLOR = "#d9d3c9"
const CUSTOM_TILESET_URL = (import.meta.env.VITE_CESIUM_BUILDINGS_TILESET_URL as string | undefined)?.trim()
const CUSTOM_ION_ASSET_ID_RAW = (import.meta.env.VITE_CESIUM_BUILDINGS_ION_ASSET_ID as string | undefined)?.trim()
const CUSTOM_ION_ASSET_ID =
  CUSTOM_ION_ASSET_ID_RAW && /^\d+$/.test(CUSTOM_ION_ASSET_ID_RAW) ? Number(CUSTOM_ION_ASSET_ID_RAW) : null

export const hasCustomBuildingsConfig = Boolean(CUSTOM_TILESET_URL || CUSTOM_ION_ASSET_ID !== null)

function applyBuildingsPerformanceProfile(tileset: any) {
  tileset.maximumScreenSpaceError = 22
  tileset.dynamicScreenSpaceError = false
  tileset.skipLevelOfDetail = false
  tileset.preferLeaves = true
  tileset.immediatelyLoadDesiredLevelOfDetail = true
  ;(tileset as any).loadSiblings = true
  ;(tileset as any).preloadFlightDestinations = false
  tileset.preloadWhenHidden = false
  ;(tileset as any).maximumMemoryUsage = 768
  ;(tileset as any).cullWithChildrenBounds = false
  tileset.enableCollision = false
}

async function tryLoadCustomTileset(Cesium: CesiumModule) {
  if (CUSTOM_ION_ASSET_ID !== null) {
    try {
      return await Cesium.Cesium3DTileset.fromIonAssetId(CUSTOM_ION_ASSET_ID)
    } catch (error) {
      if (hasCustomBuildingsConfig) {
        console.warn(`Failed to load custom 3D tileset from ion asset ${CUSTOM_ION_ASSET_ID}.`, error)
      }
    }
  }
  if (CUSTOM_TILESET_URL) {
    try {
      return await Cesium.Cesium3DTileset.fromUrl(CUSTOM_TILESET_URL)
    } catch (error) {
      console.warn(`Failed to load custom 3D tileset from ${CUSTOM_TILESET_URL}.`, error)
    }
  }
  return null
}

export async function createAppleLikeBuildingsTileset(
  Cesium: CesiumModule
): Promise<{ tileset: any; source: GlobeBuildingsSource }> {
  if (hasCustomBuildingsConfig) {
    try {
      const customTileset = await tryLoadCustomTileset(Cesium)
      if (customTileset) {
        applyBuildingsPerformanceProfile(customTileset)
        return { tileset: customTileset, source: "custom" }
      }
    } catch {
      // Fall back to OSM below.
    }
  }

  const osmTileset = await Cesium.createOsmBuildingsAsync({
    defaultColor: Cesium.Color.fromCssColorString(OSM_BUILDINGS_COLOR),
    enableShowOutline: false,
    showOutline: false,
    style: new Cesium.Cesium3DTileStyle({
      color: `color('${OSM_BUILDINGS_COLOR}')`,
    }),
  })
  applyBuildingsPerformanceProfile(osmTileset)
  return { tileset: osmTileset, source: "osm" }
}
