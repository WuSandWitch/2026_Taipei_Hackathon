/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://bus-assist-xxxx.asia-east1.run.app. Leave empty to use mock data. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
