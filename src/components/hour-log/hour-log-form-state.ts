import { todayAsInputValue } from './hour-log-form-helpers'

export interface HourLogFormValues {
  date: string
  startTime: string
  endTime: string
  hours: string
  activity: string
}

export interface FormErrors {
  date?: string
  startTime?: string
  endTime?: string
  hours?: string
  activity?: string
}

export interface HourLogFormState extends HourLogFormValues {
  errors: FormErrors
  submitting: boolean
  submitError: string | null
}

export type HourLogFormAction =
  | { type: 'SET_FIELD'; field: keyof HourLogFormValues; value: string }
  | { type: 'SET_ERRORS'; errors: FormErrors }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESET' }

export function getInitialFormValues(): HourLogFormValues {
  return {
    date: todayAsInputValue(),
    startTime: '',
    endTime: '',
    hours: '',
    activity: '',
  }
}

export function getInitialFormState(): HourLogFormState {
  return {
    ...getInitialFormValues(),
    errors: {},
    submitting: false,
    submitError: null,
  }
}

export function hourLogFormReducer(
  state: HourLogFormState,
  action: HourLogFormAction,
): HourLogFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
      }
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
      }
    case 'SUBMIT_START':
      return {
        ...state,
        submitting: true,
        submitError: null,
      }
    case 'SUBMIT_SUCCESS':
      return getInitialFormState()
    case 'SUBMIT_ERROR':
      return {
        ...state,
        submitting: false,
        submitError: action.error,
      }
    case 'RESET':
      return getInitialFormState()
    default:
      return state
  }
}
