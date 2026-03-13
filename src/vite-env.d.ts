/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly UI_DEBUG?: string
	readonly VITE_UI_DEBUG?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
