/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HF_USER?: string
  readonly VITE_HUGGINGFACE_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 