import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AddTaskForm } from './AddTaskForm'

const AREA_TYPE_LABELS = {
  lawn: 'Lawn',
  garden: 'Garden',
  natural_reserve: 'Natural reserve',
  path: 'Path / Walkway',
  wooded: 'Wooded area',
  other: 'Other',
}

const PRIORITY_LABELS = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Optional' }
const PRIORITY_COLORS = { 1: '#dc2626', 2: '#f97316', 3: '#ca8a04', 4: '#3b82f6', 5: '#6b7280' }
const CATEGORY_LABELS = {
  mowing: 'Mowing', weeding: 'Weeding', clearing: 'Clearing',
  inspection: 'Inspection', repair: 'Repair', other: 'Other',
}

const TODAY = () => new Date().toISOString().split('T')[0]

function daysAgo(isoStr) {
  if (!isoStr) return ''
  const ms = Date.now() - new Date(isoStr)
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function scheduleNext(task) {
  if (!task.interval_days) return
  const next = new Date()
  next.setDate(next.getDate() + task.interval_days)
  await supabase.from('tasks').insert({
    entity_type: task.entity_type,
    entity_id: task.entity_id,
    title: task.title,
    category: task.category,
    priority: task.priority,
    status: 'open',
    interval_days: task.interval_days,
    due_date: next.toISOString().split('T')[0],
  })
}

export function ZoneAreaPanel({ zone, tasks, onClose, onTasksChange, onAddPatch, onZonesChange }) {
  const [showAddTask, setShowAddTask] = useState(false)
  const [markingDone, setMarkingDone] = useState(null)
  const [deletingPatchId, setDeletingPatchId] = useState(null)

  async function deletePatch(patchId) {
    if (!window.confirm('Remove this patch from the zone?')) return
    setDeletingPatchId(patchId)
    await supabase.from('zone_patches').delete().eq('id', patchId)
    setDeletingPatchId(null)
    onZonesChange?.()
  }

  async function markDone(task) {
    setMarkingDone(task.id)
    await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', task.id)
    await scheduleNext(task)
    setMarkingDone(null)
    onTasksChange()
  }

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')

  // Most recent completion per category for the activity summary
  const lastByCategory = {}
  doneTasks.forEach(t => {
    if (!lastByCategory[t.category] || (t.completed_at ?? '') > (lastByCategory[t.category].completed_at ?? '')) {
      lastByCategory[t.category] = t
    }
  })
  const activityItems = Object.entries(lastByCategory)
    .sort(([, a], [, b]) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  const today = TODAY()

  return (
    <aside className="sidebar">
      <div className="panel-header">
        <div className="panel-header-info">
          <h2 className="panel-title">{zone.name}</h2>
          <span className="area-type-badge">
            {AREA_TYPE_LABELS[zone.area_type] ?? zone.area_type}
          </span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className="panel-body">
        {zone.notes && <p className="zone-notes">{zone.notes}</p>}

        {/* Patches section */}
        <div className="section-header">
          <h3>Patches ({zone.patches?.length ?? 0})</h3>
          <button className="btn-small btn-primary" onClick={onAddPatch}>
            + Add patch
          </button>
        </div>
        {zone.patches?.length > 0 && (
          <ul className="patches-list">
            {zone.patches.map((patch, i) => (
              <li key={patch.id} className="patch-item">
                <span className="patch-label">Patch {i + 1}</span>
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => deletePatch(patch.id)}
                  disabled={zone.patches.length === 1 || deletingPatchId === patch.id}
                  title={zone.patches.length === 1 ? 'Cannot remove the only patch' : 'Remove patch'}
                >
                  {deletingPatchId === patch.id ? '…' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="section-header" style={{ marginTop: 14 }}>
          <h3>Tasks ({openTasks.length})</h3>
          {!showAddTask && (
            <button className="btn-small btn-primary" onClick={() => setShowAddTask(true)}>
              + Add
            </button>
          )}
        </div>

        {showAddTask && (
          <AddTaskForm
            zoneId={zone.id}
            onSaved={() => { setShowAddTask(false); onTasksChange() }}
            onCancel={() => setShowAddTask(false)}
          />
        )}

        {openTasks.length === 0 && !showAddTask && (
          <p className="empty-text">No open tasks.</p>
        )}

        <ul className="task-list">
          {openTasks.map(task => {
            const overdue = task.due_date && task.due_date < today
            return (
              <li key={task.id} className={`task-item${overdue ? ' task-overdue' : ''}`}>
                <div className="task-main">
                  <span
                    className="priority-badge"
                    style={{ background: PRIORITY_COLORS[task.priority] }}
                    title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      {CATEGORY_LABELS[task.category] ?? task.category}
                      {task.interval_days && (
                        <span className="task-repeat" title={`Repeats every ${task.interval_days} days`}>
                          {' '}· ↻ {task.interval_days}d
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`task-due${overdue ? ' task-due--overdue' : ''}`}>
                          {' '}· {overdue ? '⚠ Overdue' : `Due ${formatDate(task.due_date)}`}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  className="btn-done"
                  onClick={() => markDone(task)}
                  disabled={markingDone === task.id}
                  title="Mark as done"
                >
                  {markingDone === task.id ? '…' : '✓'}
                </button>
              </li>
            )
          })}
        </ul>

        {activityItems.length > 0 && (
          <div className="activity-log">
            <h3>Last activity</h3>
            {activityItems.map(([cat, task]) => {
              const daysAgoVal = task.completed_at
                ? Math.floor((Date.now() - new Date(task.completed_at)) / (1000 * 60 * 60 * 24))
                : null
              const stale = task.interval_days && daysAgoVal !== null && daysAgoVal > task.interval_days
              return (
                <div key={cat} className={`activity-row${stale ? ' activity-row--stale' : ''}`}>
                  <span className="activity-cat">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="activity-age">{daysAgo(task.completed_at)}</span>
                  {task.interval_days && stale && (
                    <span className="activity-overdue-hint">overdue by {daysAgoVal - task.interval_days}d</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {doneTasks.length > 0 && (
          <details className="done-section">
            <summary>Completed ({doneTasks.length})</summary>
            <ul className="task-list done-list">
              {doneTasks.map(task => (
                <li key={task.id} className="task-item task-done">
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      {CATEGORY_LABELS[task.category] ?? task.category}
                      {task.completed_at && ` · ${daysAgo(task.completed_at)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </aside>
  )
}
