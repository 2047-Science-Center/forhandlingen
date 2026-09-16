/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sätts vid bygget för Node-hosten → appen använder wss://<host><path> som relä. */
  readonly VITE_RELAY_PATH?: string
  /** Sätts av GitHub Pages-workflowen (t.ex. '/forhandlingen/'). */
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
