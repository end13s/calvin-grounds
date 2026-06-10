import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'mowing', label: 'Mowing' },
  { value: 'weeding', label: 'Weeding' },
  { value: 'clearing', label: 'Clearing' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
]

export function AddTaskForm({ zoneId, onSaved, onCancel }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('mowing')
  const [priority, setPriority] = useState(3)
  const [dueDate, setDueDate] = useState('')
  const [intervalDays, setIntervalDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.from('tasks').insert({
      entity_type: 'zone_area',
      entity_id: zoneId,
      title: title.trim(),
      category,
      priority: Number(priority),
      status: 'open',
      due_date: dueDate || null,
      interval_days: intervalDays ? Number(intervalDays) : null,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
  }

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <h4>New task</h4>
      {error && <p className="error-text">{error}</p>}
      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Mow the central lawn"
          required
          autoFocus
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
      <div className="form-row">
        <label className="field">
          <span>Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Repeat every (days)</span>
          <input
            type="number"
            min="1"
            max="365"
            value={intervalDays}
            onChange={e => setIntervalDays(e.target.value)}
            placeholder="e.g. 7"
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
          {loading ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </form>
  )
}
