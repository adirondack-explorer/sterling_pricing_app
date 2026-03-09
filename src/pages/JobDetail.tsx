import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJobs } from '@/context/JobContext'
import RoomBuilder from '@/components/RoomBuilder'
import RoomCard from '@/components/RoomCard'
import JobSummaryBar from '@/components/JobSummaryBar'
import type { Room } from '@/types'

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getJob, createJob, addRoom, updateRoom, duplicateRoom, deleteRoom } = useJobs()

  const job = getJob(jobId ?? '')

  useEffect(() => {
    if (!jobId) return
    if (!getJob(jobId)) createJob(jobId, 'Untitled Job', '')
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined)

  if (!job) return null

  function openNew() {
    setEditingRoom(undefined)
    setBuilderOpen(true)
  }

  function openEdit(room: Room) {
    setEditingRoom(room)
    setBuilderOpen(true)
  }

  function handleSave(room: Room) {
    if (editingRoom) {
      updateRoom(job!.id, room)
    } else {
      addRoom(job!.id, room)
    }
    setBuilderOpen(false)
    setEditingRoom(undefined)
  }

  return (
    <>
      <div className="space-y-4 pb-24">
        {/* Job header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            {job.customer && <p className="text-sm text-gray-500 mt-0.5">{job.customer}</p>}
          </div>
          <button
            onClick={openNew}
            className="bg-ts-blue hover:bg-ts-teal text-white font-semibold text-sm px-4 py-2 rounded transition-colors"
          >
            + Add Room
          </button>
        </div>

        {/* Room cards */}
        {job.rooms.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-400 text-sm">No rooms yet.</p>
            <button
              onClick={openNew}
              className="mt-3 text-ts-blue hover:text-ts-teal text-sm font-medium"
            >
              + Add your first room
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {job.rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={() => openEdit(room)}
                onDuplicate={() => duplicateRoom(job.id, room.id)}
                onDelete={() => deleteRoom(job.id, room.id)}
              />
            ))}
          </div>
        )}

        <div className="pt-2">
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to Jobs
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <JobSummaryBar job={job} />

      {/* Room builder drawer */}
      {builderOpen && (
        <RoomBuilder
          jobId={job.id}
          editingRoom={editingRoom}
          onSave={handleSave}
          onClose={() => { setBuilderOpen(false); setEditingRoom(undefined) }}
        />
      )}
    </>
  )
}
