import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const base = process.env.VITE_API_URL || ''
        const upstream = await fetch(`${base}/api/sitemap.xml`)
        const body = await upstream.text()
        return new Response(body, {
          status: upstream.status,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
