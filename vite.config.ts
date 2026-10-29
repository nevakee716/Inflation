import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages sert le site sous /<repo>/ : BASE_PATH est fourni par le workflow de déploiement.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: { basepath: base },
      // Site 100 % statique : la page est pré-rendue au build, aucun serveur nécessaire.
      prerender: { enabled: true, crawlLinks: true },
    }),
    viteReact(),
  ],
})
