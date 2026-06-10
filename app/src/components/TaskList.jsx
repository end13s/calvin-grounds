import { useState } from 'react'
import { supabase } from '../lib/supabase'

const PRIORITY_LABELS = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Optional' }
const PRIORITY_COLORS = { 1: '#dc2626', 2: '#f97316', 3: '#ca8a04', 4: '#3b82f6', 5: '#6b7280' }
const CATEGORY_LABELS = {
  mowing: 'Mowing', weeding: 'Weeding', clearing: 'Clearing',
  inspection: 'Inspection', repair: 'Repair', other: 'Other',
}

const TODAY = () => new Date().toISOString().split('T')[0]

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function completedLabel(isoStr) {
  if (!isoStr) return ''
  const days = Math.floor((Date.now() - new Date(isoStr)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
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

export function TaskList({ tasks, completedTasks, zones, onZoneCenter, onTasksChange }) {
  const [mode, setMode] = useState('open')
  const [markingDone, setMarkingDone] = useState(null)

  const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]))
  const today = TODAY()

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

  if (mode === 'history') {
    return (
      <div className="todo-list-container">
        <div className="tasklist-header">
          <h2 className="todo-title">History — {completedTasks.length}</h2>
          <button className="tasklist-mode-btn tasklist-mode-btn--active" onClick={() => setMode('open')}>
            Open tasks
          </button>
        </div>
        {completedTasks.length === 0 ? (
          <div className="todo-empty"><p>No completed tasks yet.</p></div>
        ) : (
          <ul className="todo-list">
            {completedTasks.map(task => {
              const zone = zoneMap[task.entity_id]
              return (
                <li key={task.id} className="todo-item todo-item--done">
                  <span
                    className="priority-badge priority-badge--muted"
                    style={{ background: PRIORITY_COLORS[task.priority] }}
                    title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                  <div className="todo-info">
                    <span className="task-title task-title--done">{task.title}</span>
                    <span className="task-meta">
                      {CATEGORY_LABELS[task.category] ?? task.category}
                      {zone && (
                        <>
                          {' · '}
                          <button
                            className="btn-link"
                            onClick={() => { onZoneCenter(task.entity_id) }}
                            title="Center on map"
                          >
                            {zone.name}
                          </button>
                        </>
                      )}
                      {task.completed_at && ` · ${completedLabel(task.completed_at)}`}
                    </span>
                  </div>
                  <span className="done-check">✓</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  // Open tasks mode
  if (tasks.length === 0) {
    return (
      <div className="todo-list-container">
        <div className="tasklist-header">
          <h2 className="todo-title">Open tasks — 0</h2>
          <button className="tasklist-mode-btn" onClick={() => setMode('history')}>
            History
          </button>
        </div>
        <div className="todo-empty"><p>No open tasks.</p></div>
      </div>
    )
  }

  return (
    <div className="todo-list-container">
      <div className="tasklist-header">
        <h2 className="todo-title">Open tasks — {tasks.length}</h2>
        <button className="tasklist-mode-btn" onClick={() => setMode('history')}>
          History ({completedTasks.length})
        </button>
      </div>
      <ul className="todo-list">
        {tasks.map(task => {
          const zone = zoneMap[task.entity_id]
          const overdue = task.due_date && task.due_date < today
          return (
            <li key={task.id} className={`todo-item${overdue ? ' todo-item--overdue' : ''}`}>
              <span
                className="priority-badge"
                style={{ background: PRIORITY_COLORS[task.priority] }}
                title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
              >
                {task.priority}
              </span>
              <div className="todo-info">
                <span className="task-title">{task.title}</span>
                <span className="task-meta">
                  {CATEGORY_LABELS[task.category] ?? task.category}
                  {zone && (
                    <>
                      {' · '}
                      <button
                        className="btn-link"
                        onClick={() => onZoneCenter(task.entity_id)}
                        title="Center on map"
                      >
                        {zone.name}
                      </button>
                    </>
                  )}
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
    </div>
  )
}
