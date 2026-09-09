import { createFileRoute } from '@tanstack/react-router'
import { searchAssets } from '../../db/search'
import { searchResultToGeoJSON } from '../../domain/geojson'
import { isSearchError } from '../../domain/types'

export const Route = createFileRoute('/api/search.geojson')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const q = url.searchParams.get('q') ?? ''
        if (q.length > 500) {
          return Response.json({ error: 'Invalid query', code: 'invalid_query' }, { status: 400 })
        }
        const result = await searchAssets(q)
        if (isSearchError(result)) {
          const status = result.code === 'invalid_query' ? 400 : 404
          return Response.json(result, { status })
        }
        const body = JSON.stringify(searchResultToGeoJSON(result))
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'application/geo+json; charset=utf-8',
            'content-disposition': 'attachment; filename="overwatch-search.geojson"',
          },
        })
      },
    },
  },
})
