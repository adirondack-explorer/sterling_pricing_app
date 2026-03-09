import { useState } from 'react'
import { applyMultiplier, calcSellPrice } from '@/pricing/engine'
import type { Job } from '@/types'

interface Props {
  job: Job
}

export default function JobSummaryBar({ job }: Props) {
  const [marginPct, setMarginPct] = useState<number>(30)

  const listTotal = job.rooms
    .flatMap((r) => r.lineItems)
    .reduce((s, li) => s + li.listPrice, 0)

  const weightTotal = job.rooms
    .flatMap((r) => r.lineItems)
    .reduce((s, li) => s + li.weightLb, 0)

  if (listTotal === 0) return null

  const { multiplier, netCost, tier } = applyMultiplier(listTotal)
  const sellPrice = calcSellPrice(netCost, marginPct)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 shadow-2xl border-t"
      style={{ backgroundColor: '#002247', borderColor: '#0a587e' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-6 justify-between">

        {/* Left: list total + tier + net cost + weight */}
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>List Total</div>
            <div className="text-xl font-bold text-white">
              ${listTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="h-8 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />

          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Multiplier</div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#1a9ad7', color: '#ffffff' }}
              >
                {multiplier}×
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{tier}</span>
            </div>
          </div>

          <div className="h-8 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />

          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Net Cost</div>
            <div className="text-xl font-bold" style={{ color: '#1a9ad7' }}>
              ${netCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Weight</div>
            <div className="text-sm font-semibold text-white">{weightTotal.toFixed(1)} lb</div>
          </div>
        </div>

        {/* Right: margin input → sell price */}
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Gross Margin %
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={99}
                step={0.5}
                className="w-16 rounded px-2 py-1.5 text-sm text-center font-bold focus:outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                value={marginPct}
                onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
              />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>%</span>
            </div>
          </div>

          <div className="h-8 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />

          <div>
            <div className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Sell Price</div>
            <div className="text-xl font-bold text-white">
              ${sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
