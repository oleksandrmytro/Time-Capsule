/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string
  readonly VITE_API_BASE?: string
  readonly VITE_API_URL?: string
  readonly VITE_CESIUM_ION_TOKEN?: string
  readonly VITE_CESIUM_BUILDINGS_TILESET_URL?: string
  readonly VITE_CESIUM_BUILDINGS_ION_ASSET_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

