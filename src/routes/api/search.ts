import { createFileRoute } from '@tanstack/react-router'
import { searchAssets } from '../../db/search'

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const q = url.searchParams.get('q') ?? ''
        if (q.length > 500) {
          return Response.json({ error: 'Invalid query', code: 'invalid_query' }, { status: 400 })
        }
        const result = await searchAssets(q)
        const status = 'error' in result ? (result.code === 'invalid_query' ? 400 : 404) : 200
        return Response.json(result, { status })
      },
    },
  },
})
