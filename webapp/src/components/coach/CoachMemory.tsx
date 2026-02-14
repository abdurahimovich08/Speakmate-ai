/* ===========================
   CoachMemory — Coach memory editor
   =========================== */

import { useState } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { CoachMemory as CoachMemoryType } from '../../types'

interface Props {
  memory: CoachMemoryType
  saving: boolean
  onSave: (goals: string[], notes: string) => void
  onClear: () => void
}

export default function CoachMemory({ memory, saving, onSave, onClear }: Props) {
  const [goalsInput, setGoalsInput] = useState(memory.goals?.join('; ') || '')
  const [notesInput, setNotesInput] = useState(memory.notes || '')

  const handleSave = () => {
    const goals = goalsInput.split(';').map((g) => g.trim()).filter(Boolean)
    onSave(goals, notesInput)
  }

  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-sm-muted">Personalization</p>
      <h2 className="text-lg font-semibold tracking-tight mt-1">Coach memory</h2>
      <p className="text-xs text-sm-muted mt-2 leading-relaxed">{memory.panel_hint}</p>

      <label htmlFor="coach-goals" className="block text-xs mt-4 text-sm-muted">Goals (separate with ;)</label>
      <input
        id="coach-goals"
        value={goalsInput}
        onChange={(e) => setGoalsInput(e.target.value)}
        className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm outline-none"
      />

      <label htmlFor="coach-notes" className="block text-xs mt-4 text-sm-muted">Notes</label>
      <textarea
        id="coach-notes"
        value={notesInput}
        onChange={(e) => setNotesInput(e.target.value)}
        className="mt-2 w-full rounded-2xl bg-sm-card2 border border-sm-border px-4 py-3 text-sm min-h-[90px] outline-none"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onClear} disabled={saving}>
          Clear
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
