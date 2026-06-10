import { useState } from 'react'
import { supabase } from '../lib/supabase'

const AREA_TYPES = [
  { value: 'lawn', label: 'Lawn' },
  { value: 'garden', label: 'Garden' },
  { value: 'natural_reserve', label: 'Natural reserve' },
  { value: 'path', label: 'Path / Walkway' },
  { value: 'wooded', label: 'Wooded area' },
  { value: 'other', label: 'Other' },
]

const AREA_TYPE_COLORS = {
  lawn: '#22c55e',
  garden: '#f97316',
  natural_reserve: '#3b82f6',
  path: '#94a3b8',
  wooded: '#a16207',
  other: '#d946ef',
}

const CATEGORIES = [
  { value: 'mowing', label: 'Mowing' },
  { value: 'weeding', label: 'Weeding' },
  { value: 'clearing', label: 'Clearing' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
]

// ─── Bulk assign form ────────────────────────────────────────────

function BulkTaskForm({ selectedZones, onDone, onCancel }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('mowing')
  const [priority, setPriority] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)

    const rows = selectedZones.map(zone => ({
      entity_type: 'zone_area',
      entity_id: zone.id,
      title: title.trim(),
      category,
      priority: Number(priority),
      status: 'open',
    }))

    const { error: err } = await supabase.from('tasks').insert(rows)
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onDone()
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Assign task to {selectedZones.length} zone{selectedZones.length !== 1 ? 's' : ''}</h2>
        <p className="bulk-zone-names">
          {selectedZones.map(z => z.name).join(', ')}
        </p>
        {error && <p className="error-text">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Spring inspection"
              autoFocus
              required
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option value={1}>1 — Urgent</option>
                <option value={2}>2 — High</option>
                <option value={3}>3 — Normal</option>
                <option value={4}>4 — Low</option>
                <option value={5}>5 — Optional</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-save" disabled={loading || !title.trim()}>
              {loading ? 'Saving…' : `Assign to ${selectedZones.length} zone${selectedZones.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Zone row ────────────────────────────────────────────────────

function ZoneRow({ zone, selected, onToggle, onEdit, onNavigate }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [areaType, setAreaType] = useState(zone.area_type)
  const [notes, setNotes] = useState(zone.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('zone_areas')
      .update({ name: name.trim(), area_type: areaType, notes: notes.trim() || null })
      .eq('id', zone.id)
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setEditing(false)
      onEdit()
    }
  }

  function handleCancel() {
    setName(zone.name)
    setAreaType(zone.area_type)
    setNotes(zone.notes ?? '')
    setError(null)
    setEditing(false)
  }

  const color = AREA_TYPE_COLORS[zone.area_type] ?? AREA_TYPE_COLORS.other
  const typeLabel = AREA_TYPES.find(t => t.value === zone.area_type)?.label ?? zone.area_type

  if (editing) {
    return (
      <li className="zone-row zone-row--editing">
        {error && <p className="error-text">{error}</p>}
        <div className="form-row">
          <label className="field" style={{ flex: 2 }}>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Type</span>
            <select value={areaType} onChange={e => setAreaType(e.target.value)}>
              {AREA_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes about this zone…"
          />
        </label>
        <div className="form-actions">
          <button className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary btn-save" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className={`zone-row${selected ? ' zone-row--selected' : ''}`}>
      <input
        type="checkbox"
        className="zone-checkbox"
        checked={selected}
        onChange={() => onToggle(zone.id)}
        title="Select zone"
      />
      <span className="zone-color-dot" style={{ background: color }} />
      <div className="zone-row-info">
        <button className="btn-link zone-name-link" onClick={() => onNavigate(zone.id)}>
          {zone.name}
        </button>
        <span className="task-meta">{typeLabel}{zone.notes && ` · ${zone.notes}`}</span>
      </div>
      <button className="btn-ghost btn-edit" onClick={() => setEditing(true)}>Edit</button>
    </li>
  )
}

// ─── Main component ──────────────────────────────────────────────

export function ZoneDirectory({ zones, onZonesChange, onNavigate, onTasksChange }) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkForm, setShowBulkForm] = useState(false)

  function toggleZone(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === zones.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(zones.map(z => z.id)))
    }
  }

  const selectedZones = zones.filter(z => selectedIds.has(z.id))
  const allSelected = zones.length > 0 && selectedIds.size === zones.length

  if (zones.length === 0) {
    return (
      <div className="todo-empty">
        <p>No zones yet. Draw one on the map.</p>
      </div>
    )
  }

  return (
    <div className="todo-list-container">
      <div className="directory-header">
        <h2 className="todo-title">Zones — {zones.length}</h2>
        {selectedIds.size > 0 && (
          <button
            className="btn-primary btn-save"
            onClick={() => setShowBulkForm(true)}
          >
            Assign task to {selectedIds.size} zone{selectedIds.size !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      <ul className="zone-directory">
        <li className="zone-row zone-row--header">
          <input
            type="checkbox"
            className="zone-checkbox"
            checked={allSelected}
            onChange={toggleAll}
            title={allSelected ? 'Deselect all' : 'Select all'}
          />
          <span className="select-all-label">
            {allSelected ? 'Deselect all' : 'Select all'}
          </span>
        </li>
        {zones.map(zone => (
          <ZoneRow
            key={zone.id}
            zone={zone}
            selected={selectedIds.has(zone.id)}
            onToggle={toggleZone}
            onEdit={onZonesChange}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      {showBulkForm && (
        <BulkTaskForm
          selectedZones={selectedZones}
          onDone={() => {
            setShowBulkForm(false)
            setSelectedIds(new Set())
            onTasksChange?.()
          }}
          onCancel={() => setShowBulkForm(false)}
        />
      )}
    </div>
  )
}
