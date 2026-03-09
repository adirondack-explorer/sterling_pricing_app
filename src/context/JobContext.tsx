import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type { Job, Room, LineItem } from '@/types'

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  jobs: Job[]
}

const initialState: State = { jobs: [] }

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'CREATE_JOB'; payload: { id: string; name: string; customer: string } }
  | { type: 'DELETE_JOB'; payload: { jobId: string } }
  | { type: 'ADD_ROOM'; payload: { jobId: string; room: Room } }
  | { type: 'UPDATE_ROOM'; payload: { jobId: string; room: Room } }
  | { type: 'DUPLICATE_ROOM'; payload: { jobId: string; roomId: string; newId: string } }
  | { type: 'DELETE_ROOM'; payload: { jobId: string; roomId: string } }
  | { type: 'ADD_LINE_ITEM'; payload: { jobId: string; roomId: string; item: LineItem } }
  | { type: 'DELETE_LINE_ITEM'; payload: { jobId: string; roomId: string; itemId: string } }

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CREATE_JOB': {
      const { id, name, customer } = action.payload
      const job: Job = {
        id,
        name,
        customer,
        createdAt: new Date().toISOString().slice(0, 10),
        rooms: [],
      }
      return { jobs: [...state.jobs, job] }
    }

    case 'DELETE_JOB':
      return { jobs: state.jobs.filter((j) => j.id !== action.payload.jobId) }

    case 'ADD_ROOM':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.jobId
            ? { ...j, rooms: [...j.rooms, action.payload.room] }
            : j,
        ),
      }

    case 'UPDATE_ROOM':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.jobId
            ? {
                ...j,
                rooms: j.rooms.map((r) =>
                  r.id === action.payload.room.id ? action.payload.room : r,
                ),
              }
            : j,
        ),
      }

    case 'DUPLICATE_ROOM':
      return {
        jobs: state.jobs.map((j) => {
          if (j.id !== action.payload.jobId) return j
          const original = j.rooms.find((r) => r.id === action.payload.roomId)
          if (!original) return j
          const copy: Room = {
            ...original,
            id: action.payload.newId,
            name: `${original.name} (copy)`,
            lineItems: original.lineItems.map((li) => ({
              ...li,
              id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            })),
          }
          return { ...j, rooms: [...j.rooms, copy] }
        }),
      }

    case 'DELETE_ROOM':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.jobId
            ? { ...j, rooms: j.rooms.filter((r) => r.id !== action.payload.roomId) }
            : j,
        ),
      }

    case 'ADD_LINE_ITEM':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.jobId
            ? {
                ...j,
                rooms: j.rooms.map((r) =>
                  r.id === action.payload.roomId
                    ? { ...r, lineItems: [...r.lineItems, action.payload.item] }
                    : r,
                ),
              }
            : j,
        ),
      }

    case 'DELETE_LINE_ITEM':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.jobId
            ? {
                ...j,
                rooms: j.rooms.map((r) =>
                  r.id === action.payload.roomId
                    ? { ...r, lineItems: r.lineItems.filter((li) => li.id !== action.payload.itemId) }
                    : r,
                ),
              }
            : j,
        ),
      }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface JobContextValue {
  jobs: Job[]
  createJob: (id: string, name: string, customer: string) => void
  deleteJob: (jobId: string) => void
  addRoom: (jobId: string, room: Room) => void
  updateRoom: (jobId: string, room: Room) => void
  duplicateRoom: (jobId: string, roomId: string) => void
  deleteRoom: (jobId: string, roomId: string) => void
  addLineItem: (jobId: string, roomId: string, item: LineItem) => void
  deleteLineItem: (jobId: string, roomId: string, itemId: string) => void
  getJob: (jobId: string) => Job | undefined
}

const JobContext = createContext<JobContextValue | null>(null)

export function JobProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const value: JobContextValue = {
    jobs: state.jobs,
    createJob: (id, name, customer) =>
      dispatch({ type: 'CREATE_JOB', payload: { id, name, customer } }),
    deleteJob: (jobId) =>
      dispatch({ type: 'DELETE_JOB', payload: { jobId } }),
    addRoom: (jobId, room) =>
      dispatch({ type: 'ADD_ROOM', payload: { jobId, room } }),
    updateRoom: (jobId, room) =>
      dispatch({ type: 'UPDATE_ROOM', payload: { jobId, room } }),
    duplicateRoom: (jobId, roomId) =>
      dispatch({ type: 'DUPLICATE_ROOM', payload: { jobId, roomId, newId: `room-${Date.now()}` } }),
    deleteRoom: (jobId, roomId) =>
      dispatch({ type: 'DELETE_ROOM', payload: { jobId, roomId } }),
    addLineItem: (jobId, roomId, item) =>
      dispatch({ type: 'ADD_LINE_ITEM', payload: { jobId, roomId, item } }),
    deleteLineItem: (jobId, roomId, itemId) =>
      dispatch({ type: 'DELETE_LINE_ITEM', payload: { jobId, roomId, itemId } }),
    getJob: (jobId) => state.jobs.find((j) => j.id === jobId),
  }

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>
}

export function useJobs() {
  const ctx = useContext(JobContext)
  if (!ctx) throw new Error('useJobs must be used within <JobProvider>')
  return ctx
}
