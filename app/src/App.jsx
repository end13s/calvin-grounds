import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Map } from './components/Map'
import { ZoneAreaPanel } from './components/ZoneAreaPanel'
import { TaskList } from './components/TaskList'
import { SaveZoneModal } from './components/SaveZoneModal'
import { ZoneDirectory } from './components/ZoneDirectory'
import { MapOverlay } from './components/MapOverlay'
import './App.css'

async function fetchZones() {
  const { data, error } = await supabase.rpc('get_zone_areas')
  return !error && data ? data : null
}

async function fetchZoneTasks(zoneId) {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('entity_type', 'zone_area')
    .eq('entity_id', zoneId)
    .order('priority', { ascending: true })
  return data ?? []
}

async function fetchOpenTasks() {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('entity_type', 'zone_area')
    .eq('status', 'open')
    .order('priority', { ascending: true })
  return data ?? []
}

async function fetchCompletedTasks() {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('entity_type', 'zone_area')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(300)
  return data ?? []
}

export default function App() {
  const [zones, setZones] = useState([])
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  // Tagged with the zone they belong to, so a slow response never shows under another zone
  const [zoneTasks, setZoneTasks] = useState({ zoneId: null, tasks: [] })
  const [allOpenTasks, setAllOpenTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [view, setView] = useState('map') // 'map' | 'todo'
  const [isDrawingActive, setIsDrawingActive] = useState(false)
  const [patchTargetZoneId, setPatchTargetZoneId] = useState(null) // set when adding patch to existing zone
  const [pendingGeometry, setPendingGeometry] = useState(null)
  const [savingZone, setSavingZone] = useState(false)
  const [saveZoneError, setSaveZoneError] = useState(null)
  const [savingPatch, setSavingPatch] = useState(false)
  // flyRequest = { zoneId, seq } — seq changes even for repeated same zone
  const [flyRequest, setFlyRequest] = useState(null)

  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null

  const selectedZoneTasks = zoneTasks.zoneId === selectedZoneId ? zoneTasks.tasks : []

  async function loadZones() {
    const data = await fetchZones()
    if (data) setZones(data)
  }

  async function loadZoneTasks(zoneId) {
    setZoneTasks({ zoneId, tasks: await fetchZoneTasks(zoneId) })
  }

  async function loadAllOpenTasks() {
    setAllOpenTasks(await fetchOpenTasks())
  }

  async function loadCompletedTasks() {
    setCompletedTasks(await fetchCompletedTasks())
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchZones(), fetchOpenTasks(), fetchCompletedTasks()]).then(([zonesData, open, done]) => {
      if (cancelled) return
      if (zonesData) setZones(zonesData)
      setAllOpenTasks(open)
      setCompletedTasks(done)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedZoneId) return
    let cancelled = false
    fetchZoneTasks(selectedZoneId).then(tasks => {
      if (!cancelled) setZoneTasks({ zoneId: selectedZoneId, tasks })
    })
    return () => { cancelled = true }
  }, [selectedZoneId])

  function handleZoneSelect(id) {
    setSelectedZoneId(id)
  }

  async function handleDrawComplete(geometry) {
    setIsDrawingActive(false)
    if (patchTargetZoneId) {
      setSavingPatch(true)
      await supabase.rpc('add_zone_patch', {
        p_zone_id: patchTargetZoneId,
        p_geojson: geometry,
      })
      setPatchTargetZoneId(null)
      setSavingPatch(false)
      await loadZones()
    } else {
      setPendingGeometry(geometry)
    }
  }

  function handleAddPatch(zoneId) {
    setPatchTargetZoneId(zoneId)
    setIsDrawingActive(true)
  }

  async function handleSaveZone(name, areaType) {
    setSavingZone(true)
    setSaveZoneError(null)
    try {
      const { data, error } = await supabase.rpc('create_zone_area', {
        p_name: name,
        p_area_type: areaType,
        p_geojson: pendingGeometry,
      })
      if (error) {
        console.error('create_zone_area error:', error)
        setSaveZoneError(error.message)
      } else {
        setPendingGeometry(null)
        setSaveZoneError(null)
        await loadZones()
        if (data) setSelectedZoneId(data)
      }
    } catch (e) {
      console.error('handleSaveZone threw:', e)
      setSaveZoneError(e.message ?? 'Unexpected error')
    } finally {
      setSavingZone(false)
    }
  }

  function handleCancelSaveZone() {
    setPendingGeometry(null)
    setSaveZoneError(null)
  }

  function handleTasksChange() {
    if (selectedZoneId) loadZoneTasks(selectedZoneId)
    loadAllOpenTasks()
    loadCompletedTasks()
  }

  const today = new Date().toISOString().split('T')[0]
  const overdueCount = allOpenTasks.filter(t => t.due_date && t.due_date < today).length

  function handleZoneCenter(zoneId) {
    setSelectedZoneId(zoneId)
    setFlyRequest(prev => ({ zoneId, seq: (prev?.seq ?? 0) + 1 }))
    setView('map')
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
          Calvin Grounds
        </span>
        <nav className="app-nav">
          <button
            className={`nav-btn${view === 'map' ? ' active' : ''}`}
            onClick={() => setView('map')}
          >
            Map
          </button>
          <button
            className={`nav-btn${view === 'todo' ? ' active' : ''}`}
            onClick={() => setView('todo')}
          >
            Tasks
            {allOpenTasks.length > 0 && (
              <span className="nav-badge">{allOpenTasks.length}</span>
            )}
          </button>
          <button
            className={`nav-btn${view === 'zones' ? ' active' : ''}`}
            onClick={() => setView('zones')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
            Zones
          </button>
        </nav>
      </header>

      <div className="app-body">
        {view === 'map' ? (
          <div className="map-layout">
            <div className="map-container">
              <Map
                zones={zones}
                selectedZoneId={selectedZoneId}
                onZoneSelect={handleZoneSelect}
                onDrawComplete={handleDrawComplete}
                isDrawingActive={isDrawingActive}
                flyRequest={flyRequest}
              />
              <MapOverlay openTaskCount={allOpenTasks.length} overdueCount={overdueCount} />
              {isDrawingActive && (
                <div className="drawing-hint">
                  {patchTargetZoneId
                    ? <>Adding patch to <strong>{zones.find(z => z.id === patchTargetZoneId)?.name}</strong> &nbsp;·&nbsp; Click the <strong>first point</strong> to close</>
                    : <>Click to place points &nbsp;·&nbsp; Click the <strong>first point</strong> to close the polygon</>
                  }
                </div>
              )}
              {savingPatch && (
                <div className="drawing-hint">Saving patch…</div>
              )}
              <div className="map-controls">
                {isDrawingActive ? (
                  <button
                    className="btn-control btn-danger"
                    onClick={() => { setIsDrawingActive(false); setPatchTargetZoneId(null) }}
                  >
                    ✕ Cancel drawing
                  </button>
                ) : (
                  <button
                    className="btn-control btn-primary"
                    onClick={() => {
                      setSelectedZoneId(null)
                      setIsDrawingActive(true)
                    }}
                  >
                    + Add zone
                  </button>
                )}
              </div>
            </div>

            {selectedZone && (
              <ZoneAreaPanel
                zone={selectedZone}
                tasks={selectedZoneTasks}
                onClose={() => setSelectedZoneId(null)}
                onTasksChange={handleTasksChange}
                onAddPatch={() => handleAddPatch(selectedZoneId)}
                onZonesChange={loadZones}
              />
            )}
          </div>
        ) : view === 'todo' ? (
          <div className="todo-layout">
            <TaskList
              tasks={allOpenTasks}
              completedTasks={completedTasks}
              zones={zones}
              onZoneCenter={handleZoneCenter}
              onTasksChange={handleTasksChange}
            />
          </div>
        ) : (
          <div className="todo-layout">
            <ZoneDirectory
              zones={zones}
              onZonesChange={loadZones}
              onNavigate={handleZoneCenter}
              onTasksChange={handleTasksChange}
            />
          </div>
        )}
      </div>

      {pendingGeometry && (
        <SaveZoneModal
          onSave={handleSaveZone}
          onCancel={handleCancelSaveZone}
          loading={savingZone}
          error={saveZoneError}
        />
      )}
    </div>
  )
}
