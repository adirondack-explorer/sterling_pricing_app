import type { Room } from '@/types'

interface Props {
  room: Room
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const FAMILY_LABEL: Record<string, string> = {
  enclosure: 'Enclosure',
  element: 'Element',
  'rough-in': 'Rough-In',
  modification: 'Modification',
  'pipe-enclosure': 'Pipe',
}

const FINISH_SHORT: Record<string, string> = {
  prime: 'Prime',
  baked_powder: 'Bkd Pdr',
  baked_metallic: 'Bkd Met',
  two_tone: '2-Tone',
}

export default function RoomCard({ room, onEdit, onDuplicate, onDelete }: Props) {
  const listTotal = room.lineItems.reduce((s, li) => s + li.listPrice, 0)
  const weightTotal = room.lineItems.reduce((s, li) => s + li.weightLb, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-800">{room.name}</span>
          <span className="text-xs text-gray-400">
            {room.lineItems.length} {room.lineItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="text-xs text-ts-blue hover:text-ts-teal font-medium px-2 py-1 rounded transition"
          >
            Edit
          </button>
          <button
            onClick={onDuplicate}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition"
          >
            Duplicate
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Line items table */}
      {room.lineItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2 text-left font-medium w-8">#</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Model / Item</th>
                <th className="px-4 py-2 text-left font-medium">Details</th>
                <th className="px-4 py-2 text-right font-medium">Length</th>
                <th className="px-4 py-2 text-right font-medium">List Price</th>
                <th className="px-4 py-2 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {room.lineItems.map((li, idx) => (
                <tr key={li.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-300">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {FAMILY_LABEL[li.productFamily] ?? li.productFamily}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-mono text-xs text-gray-700">{li.modelId}</div>
                    <div className="text-xs text-gray-400 truncate max-w-48">{li.modelLabel}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {li.gauge && <span className="mr-2">{li.gauge}</span>}
                    {li.finish !== 'prime' && <span>{FINISH_SHORT[li.finish]}</span>}
                    {li.accessories.length > 0 && (
                      <div className="text-gray-400 mt-0.5">
                        + {li.accessories.map((a) => a.label).join(', ')}
                      </div>
                    )}
                    {li.notes && <div className="text-gray-400">{li.notes}</div>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
                    {li.billedLengthFt > 0 ? `${li.billedLengthFt}'` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-800 whitespace-nowrap">
                    ${li.listPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-gray-400 whitespace-nowrap">
                    {li.weightLb > 0 ? `${li.weightLb} lb` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-4 py-2 text-xs text-gray-500 text-right font-medium">
                  Room Totals
                </td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">
                  ${listTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                  {weightTotal.toFixed(1)} lb
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-gray-300">
          No items — click Edit to add items
        </div>
      )}
    </div>
  )
}
