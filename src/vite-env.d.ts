/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HYPERBOLIC_API_KEY: string
  readonly VITE_CDP_API_KEY_NAME: string
  readonly VITE_CDP_API_KEY_PRIVATE_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_NETWORK_ID: string
  readonly VITE_MONGODB_URI: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_AGENT_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}