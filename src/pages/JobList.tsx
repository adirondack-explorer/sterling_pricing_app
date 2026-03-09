import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '@/context/JobContext'

export default function JobList() {
  const navigate = useNavigate()
  const { jobs, createJob, deleteJob } = useJobs()
  const [newJobName, setNewJobName] = useState('')
  const [newCustomer, setNewCustomer] = useState('')

  function handleCreate() {
    const name = newJobName.trim()
    if (!name) return
    const id = `job-${Date.now()}`
    createJob(id, name, newCustomer.trim())
    setNewJobName('')
    setNewCustomer('')
    navigate(`/jobs/${id}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>

      {/* New job form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Job</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ts-blue"
            placeholder="Job name"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ts-blue"
            placeholder="Customer (optional)"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            className="bg-ts-blue hover:bg-ts-teal text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {jobs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No jobs yet. Create one above.</p>
        )}
        {jobs.map((job) => {
          const roomCount = job.rooms.length
          const total = job.rooms
            .flatMap((r) => r.lineItems)
            .reduce((sum, li) => sum + li.listPrice, 0)

          return (
            <div
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:border-ts-blue hover:shadow-sm transition group"
            >
              <div>
                <div className="font-medium text-gray-900">{job.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {job.customer && <span className="mr-2">{job.customer}</span>}
                  {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
                  {total > 0 && (
                    <span className="ml-2 text-gray-500">
                      · List: ${total.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-300">{job.createdAt}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteJob(job.id) }}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-sm px-1"
                  title="Delete job"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
