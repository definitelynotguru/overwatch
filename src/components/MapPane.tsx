import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { Asset, AssetGeometry } from '../domain/types'

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json'

type Props = {
  assets: Asset[]
  cluster: boolean
  selectedId: string | null
  flyTo: Asset | null
  onSelect: (id: string) => void
  onClusterChange: (cluster: boolean) => void
}

function centroidPoint(a: Asset): Point {
  return { type: 'Point', coordinates: [a.lon, a.lat] }
}

function asGeometry(a: Asset): Geometry {
  const g = a.geometry
  if (g && typeof g.type === 'string' && g.coordinates != null) {
    return g as Geometry
  }
  return centroidPoint(a)
}

function toCentroidGeoJSON(assets: Asset[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      id: a.id,
      properties: { id: a.id, name: a.name, type: a.type },
      geometry: centroidPoint(a),
    })),
  }
}

function toShapeGeoJSON(assets: Asset[]): FeatureCollection {
  const features: Feature[] = []
  for (const a of assets) {
    const geometry = asGeometry(a)
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint') continue
    features.push({
      type: 'Feature',
      id: a.id,
      properties: { id: a.id, name: a.name, type: a.type },
      geometry,
    })
  }
  return { type: 'FeatureCollection', features }
}

function walkCoords(coords: unknown, visit: (lon: number, lat: number) => void) {
  if (!Array.isArray(coords) || coords.length === 0) return
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    visit(coords[0], coords[1])
    return
  }
  for (const c of coords) walkCoords(c, visit)
}

function extendGeometry(bounds: maplibregl.LngLatBounds, geom: AssetGeometry | Geometry | null, lat: number, lon: number) {
  bounds.extend([lon, lat])
  if (geom && 'coordinates' in geom) walkCoords(geom.coordinates, (x, y) => bounds.extend([x, y]))
}

function addLayers(map: maplibregl.Map, cluster: boolean) {
  if (map.getSource('hits')) return

  map.addSource('hits', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })
  map.addSource('hits-shapes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'hit-fills',
    type: 'fill',
    source: 'hits-shapes',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.28,
    },
  })
  map.addLayer({
    id: 'hit-lines',
    type: 'line',
    source: 'hits-shapes',
    paint: {
      'line-color': '#60a5fa',
      'line-width': 3,
    },
  })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'hits',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#60a5fa',
        8,
        '#fbbf24',
        25,
        '#f97316',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 16, 8, 20, 25, 26],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0b0b0b',
    },
  })

  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'hits',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#3b82f6',
      'circle-radius': 6,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  })

  try {
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'hits',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['to-string', ['get', 'point_count']],
        'text-size': 12,
        'text-font': ['Noto Sans Regular'],
      },
      paint: { 'text-color': '#111111' },
    })
  } catch {
    // Circles stay even if glyphs are missing.
  }
}

function dropHitLayers(map: maplibregl.Map) {
  for (const id of ['cluster-count', 'clusters', 'points', 'hit-lines', 'hit-fills']) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource('hits')) map.removeSource('hits')
  if (map.getSource('hits-shapes')) map.removeSource('hits-shapes')
}

function applyHits(map: maplibregl.Map, assets: Asset[], cluster: boolean) {
  if (!map.isStyleLoaded()) return
  if (!map.getSource('hits')) addLayers(map, cluster)
  const src = map.getSource('hits') as maplibregl.GeoJSONSource | undefined
  src?.setData(toCentroidGeoJSON(assets))
  const shapes = map.getSource('hits-shapes') as maplibregl.GeoJSONSource | undefined
  shapes?.setData(toShapeGeoJSON(assets))
}

export function MapPane({
  assets,
  cluster,
  selectedId,
  flyTo,
  onSelect,
  onClusterChange,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const clusterRef = useRef(cluster)
  clusterRef.current = cluster

  useEffect(() => {
    if (!host.current || mapRef.current) return
    const container = host.current
    let fellBack = false
    const map = new maplibregl.Map({
      container,
      style: OPENFREEMAP_STYLE,
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    })
    map.resize()
    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(container)
    requestAnimationFrame(() => map.resize())

    const onLoad = () => {
      applyHits(map, assetsRef.current, clusterRef.current)
    }
    const fallback = () => {
      if (fellBack) return
      fellBack = true
      map.setStyle(FALLBACK_STYLE)
    }
    map.on('load', onLoad)
    map.on('style.load', onLoad)
    if (map.loaded() || map.isStyleLoaded()) onLoad()
    map.on('error', (e) => {
      if (fellBack || map.isStyleLoaded()) return
      if ('sourceId' in e && e.sourceId) return
      const msg = String((e as { error?: { message?: string } }).error?.message ?? '')
      if (
        msg.includes('openfreemap') ||
        msg.includes('styles/dark') ||
        msg.includes('Failed to fetch') ||
        msg.includes('AJAXError')
      ) {
        fallback()
      }
    })
    const stall = window.setTimeout(() => {
      if (!map.isStyleLoaded()) fallback()
    }, 8000)

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', 'clusters', (e) => {
      const feature = e.features?.[0]
      const id = feature?.properties?.cluster_id
      const coords = (feature?.geometry as Point | undefined)?.coordinates
      if (id == null || !coords) return
      const source = map.getSource('hits') as maplibregl.GeoJSONSource
      void source.getClusterExpansionZoom(id).then((zoom) => {
        if (zoom == null) return
        map.easeTo({ center: coords as [number, number], zoom })
      })
    })
    const pick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelectRef.current(id)
    }
    map.on('click', 'points', pick)
    map.on('click', 'hit-lines', pick)
    map.on('click', 'hit-fills', pick)
    for (const layer of ['clusters', 'points', 'hit-lines', 'hit-fills']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = ''
      })
    }
    mapRef.current = map

    return () => {
      window.clearTimeout(stall)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    dropHitLayers(map)
    applyHits(map, assets, cluster)
  }, [cluster])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyHits(map, assets, clusterRef.current)
    if (assets.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const a of assets) extendGeometry(bounds, a.geometry, a.lat, a.lon)
    map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 600 })
  }, [assets])

  useEffect(() => {
    if (!flyTo || !mapRef.current) return
    mapRef.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 13, speed: 1.2 })
  }, [flyTo])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('points')) return
    map.setPaintProperty('points', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      9,
      6,
    ])
    map.setPaintProperty('points', 'circle-color', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      '#fbbf24',
      '#3b82f6',
    ])
    if (map.getLayer('hit-lines')) {
      map.setPaintProperty('hit-lines', 'line-color', [
        'case',
        ['==', ['get', 'id'], selectedId ?? ''],
        '#fbbf24',
        '#60a5fa',
      ])
    }
    if (map.getLayer('hit-fills')) {
      map.setPaintProperty('hit-fills', 'fill-color', [
        'case',
        ['==', ['get', 'id'], selectedId ?? ''],
        '#fbbf24',
        '#3b82f6',
      ])
    }
  }, [selectedId])

  return (
    <div className="map-pane">
      <div className="map-root" ref={host} />
      <label className="map-cluster-toggle">
        <input
          type="checkbox"
          checked={cluster}
          onChange={(e) => onClusterChange(e.target.checked)}
        />
        Cluster markers
      </label>
      <div className="map-attrib">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        {' · '}
        <a href="https://www.openmaptiles.org" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>
        {' · '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OSM
        </a>
      </div>
    </div>
  )
}
