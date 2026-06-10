import { useState } from 'react'

const AREA_TYPES = [
  { value: 'lawn', label: 'Lawn' },
  { value: 'garden', label: 'Garden' },
  { value: 'natural_reserve', label: 'Natural reserve' },
  { value: 'path', label: 'Path / Walkway' },
  { value: 'wooded', label: 'Wooded area' },
  { value: 'other', label: 'Other' },
]

export function SaveZoneModal({ onSave, onCancel, loading, error }) {
  const [name, setName] = useState('')
  const [areaType, setAreaType] = useState('lawn')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), areaType)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Save zone</h2>
        {error && <p className="error-text">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Zone name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Central lawn"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>Zone type</span>
            <select value={areaType} onChange={e => setAreaType(e.target.value)}>
              {AREA_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
