import { type FormEvent, useReducer } from 'react'
import { createLocalHourLog } from '@/offline/createLocalHourLog'
import {
  computeDurationLabel,
  formatDateForConfirmation,
  validateHourLogForm,
  validateHourLogInput,
} from './hour-log-form-helpers'
import {
  getInitialFormState,
  hourLogFormReducer,
  type HourLogFormValues,
} from './hour-log-form-state'

export interface UseHourLogFormOptions {
  placementId: number
  onSaved?: () => void
}

export function useHourLogForm({ placementId, onSaved }: UseHourLogFormOptions) {
  const [state, dispatch] = useReducer(hourLogFormReducer, undefined, getInitialFormState)

  const confirmationLabel = formatDateForConfirmation(state.date)
  const durationLabel = computeDurationLabel(state.startTime, state.endTime)
  const liveHoursWarning = state.hours
    ? validateHourLogInput(state.hours, state.startTime, state.endTime)
    : null

  const setField = (field: keyof HourLogFormValues, value: string) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }

  const resetForm = () => dispatch({ type: 'RESET' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateHourLogForm(state)
    dispatch({ type: 'SET_ERRORS', errors: nextErrors })

    if (Object.keys(nextErrors).length > 0) return

    dispatch({ type: 'SUBMIT_START' })

    try {
      await createLocalHourLog(placementId, state)
      dispatch({ type: 'SUBMIT_SUCCESS' })
      onSaved?.()
    } catch {
      dispatch({
        type: 'SUBMIT_ERROR',
        error: 'No se pudo guardar el registro en este dispositivo. Intenta de nuevo.',
      })
    }
  }

  return {
    ...state,
    setDate: (v: string) => setField('date', v),
    setStartTime: (v: string) => setField('startTime', v),
    setEndTime: (v: string) => setField('endTime', v),
    setHours: (v: string) => setField('hours', v),
    setActivity: (v: string) => setField('activity', v),
    confirmationLabel,
    durationLabel,
    liveHoursWarning,
    setField,
    resetForm,
    handleSubmit,
  }
}
