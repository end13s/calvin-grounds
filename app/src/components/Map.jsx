import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRenderMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'

// MapLibre 6 looks for its web worker next to its own module file, which the build does not
// emit; hand it the worker bundled by Vite so zone polygons render in dev and production.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

const AREA_TYPE_COLORS = {
  lawn: '#22c55e',
  garden: '#f97316',
  natural_reserve: '#3b82f6',
  path: '#94a3b8',
  wooded: '#a16207',
  other: '#d946ef',
}

// Each patch becomes its own GeoJSON feature; zone_id links patches to their zone
function zonesToGeoJSON(zones) {
  return {
    type: 'FeatureCollection',
    features: zones.flatMap(zone =>
      (zone.patches ?? []).map(patch => ({
        type: 'Feature',
        id: patch.id,
        properties: {
          zone_id: zone.id,
          patch_id: patch.id,
          name: zone.name,
          area_type: zone.area_type,
          color: AREA_TYPE_COLORS[zone.area_type] ?? AREA_TYPE_COLORS.other,
        },
        geometry: patch.geojson,
      }))
    ),
  }
}

export function Map({ zones, selectedZoneId, onZoneSelect, onDrawComplete, isDrawingActive, flyRequest }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const drawRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Stable refs for callbacks — avoids stale closures in map event handlers
  const onZoneSelectRef = useRef(onZoneSelect)
  const onDrawCompleteRef = useRef(onDrawComplete)
  const isDrawingRef = useRef(isDrawingActive)

  useEffect(() => { onZoneSelectRef.current = onZoneSelect }, [onZoneSelect])
  useEffect(() => { onDrawCompleteRef.current = onDrawComplete }, [onDrawComplete])
  useEffect(() => { isDrawingRef.current = isDrawingActive }, [isDrawingActive])

  // Initialize map once
  useEffect(() => {
    let unmounted = false

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          esri: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Imagery © Esri',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri' }],
      },
      center: [-85.5885, 42.9315],
      zoom: 16,
      minZoom: 15,
      maxZoom: 21,
      maxBounds: [[-85.615, 42.917], [-85.562, 42.946]],
    })

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

    map.on('load', () => {
      if (unmounted) return

      map.addSource('zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 },
      })

      map.addLayer({
        id: 'zones-fill-selected',
        type: 'fill',
        source: 'zones',
        filter: ['==', ['get', 'zone_id'], ''],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.65 },
      })

      map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: 'zones',
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
      })

      map.on('click', 'zones-fill', (e) => {
        if (isDrawingRef.current) return
        const feat = e.features?.[0]
        if (feat) onZoneSelectRef.current(feat.properties.zone_id)
      })

      map.on('click', (e) => {
        if (isDrawingRef.current) return
        const feats = map.queryRenderedFeatures(e.point, { layers: ['zones-fill'] })
        if (feats.length === 0) onZoneSelectRef.current(null)
      })

      map.on('mouseenter', 'zones-fill', () => {
        if (!isDrawingRef.current) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'zones-fill', () => {
        if (!isDrawingRef.current) map.getCanvas().style.cursor = ''
      })

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawRenderMode({ modeName: 'render', styles: {} }),
          new TerraDrawPolygonMode(),
        ],
      })

      draw.start()
      draw.setMode('render')

      draw.on('finish', (id) => {
        const features = draw.getSnapshot()
        const feat = features.find(f => f.id === id)
        if (feat?.geometry) {
          onDrawCompleteRef.current(feat.geometry)
        }
        map.doubleClickZoom.enable()
        // Terra Draw throws if it is already in this mode or already empty; both are fine here.
        try { draw.setMode('render') } catch { /* already rendering */ }
        try { draw.clear() } catch { /* nothing to clear */ }
      })

      drawRef.current = draw
      setMapLoaded(true)
    })

    mapRef.current = map

    return () => {
      unmounted = true
      if (drawRef.current) {
        try { drawRef.current.stop() } catch { /* already stopped */ }
        drawRef.current = null
      }
      map.remove()
    }
  }, [])

  // Sync zones GeoJSON to map source
  useEffect(() => {
    if (!mapLoaded) return
    mapRef.current?.getSource('zones')?.setData(zonesToGeoJSON(zones))
  }, [zones, mapLoaded])

  // Highlight all patches of the selected zone
  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current
    if (map?.getLayer('zones-fill-selected')) {
      map.setFilter('zones-fill-selected', ['==', ['get', 'zone_id'], selectedZoneId ?? ''])
    }
  }, [selectedZoneId, mapLoaded])

  // Activate / deactivate drawing mode
  useEffect(() => {
    if (!mapLoaded || !drawRef.current) return
    const map = mapRef.current
    if (isDrawingActive) {
      map?.doubleClickZoom.disable()
      drawRef.current.setMode('polygon')
    } else {
      map?.doubleClickZoom.enable()
      try { drawRef.current.setMode('render') } catch { /* already rendering */ }
      try { drawRef.current.clear() } catch { /* nothing to clear */ }
    }
  }, [isDrawingActive, mapLoaded])

  // Fly to fit all patches of the requested zone
  useEffect(() => {
    if (!flyRequest?.zoneId || !mapLoaded) return
    const zone = zones.find(z => z.id === flyRequest.zoneId)
    if (!zone?.patches?.length) return

    const allCoords = zone.patches.flatMap(p => p.geojson?.coordinates?.[0] ?? [])
    if (!allCoords.length) return

    const lons = allCoords.map(c => c[0])
    const lats = allCoords.map(c => c[1])
    mapRef.current?.fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: 80, duration: 800 }
    )
  }, [flyRequest, mapLoaded, zones])

  return <div ref={containerRef} className="map-canvas" />
}
