import { useState, useMemo, type ReactNode } from 'react'
import type { LineItem, FinishOption, EnclosureFamily } from '@/types'
import {
  ENCLOSURE_CATALOGS,
  ENCLOSURE_FAMILY_LABELS,
  ENCLOSURE_FAMILIES,
  getModelsForFamily,
  getAccessoryOptions,
  type AccessoryOption,
} from '@/data/catalog-registry'
import {
  calcEnclosurePrice,
  calcElementPrice,
  calcRoughInPrice,
  roundToSterlingLength,
} from '@/pricing/engine'
import roughInData from '@data/rough-in.json'
import modsData from '@data/modifications.json'
import pipeData from '@data/pipe-enclosures.json'
import elementsData from '@data/elements.json'
import type { Room } from '@/types'

// ─── Enclosure context (lifted up from EnclosureSection) ──────────────────────

type Offset = 'K' | 'A' | 'B'

interface EnclosureCtx {
  offset: Offset | null
  heightIn: number | null
  family: EnclosureFamily | null
}

/** Derive the K/A/B offset from a model's depth_label ("A_LI" → "A", etc.) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function offsetOfModel(model: any): Offset | null {
  const dl = model?.depth_label as string | undefined
  if (!dl) return null
  if (dl.startsWith('K')) return 'K'
  if (dl.startsWith('A')) return 'A'
  if (dl.startsWith('B')) return 'B'
  return null
}

/** Is this element fin-depth compatible with the given enclosure offset? */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isElementCompatible(element: any, offset: Offset | null): boolean {
  if (!offset) return true // element-only mode — show all
  const depth = element.fin_depth_in as number
  if (offset === 'K') return depth <= 2.75
  if (offset === 'A') return depth <= 3.25
  if (offset === 'B') return depth >= 4.0
  return true
}

/** Enclosure families that do NOT support RWLI / RWDB modifications */
const MODS_EXCLUDED_FAMILIES: EnclosureFamily[] = ['classic-standard', 'dura-vane']

// ─── Shared sub-components ────────────────────────────────────────────────────

const FINISH_LABELS: Record<FinishOption, string> = {
  prime: 'Prime',
  baked_powder: 'Baked Powder',
  baked_metallic: 'Baked Metallic',
  two_tone: 'Two-Tone',
}

function SectionAccordion({
  id, title, badge, open, onToggle, dimmed, children,
}: {
  id: string; title: string; badge?: number; open: boolean
  onToggle: (id: string) => void; dimmed?: boolean; children: ReactNode
}) {
  return (
    <div className={`border-b border-gray-100 last:border-0 ${dimmed ? 'opacity-40 pointer-events-none' : ''}`}>
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition"
        onClick={() => onToggle(id)}
      >
        <span className="font-semibold text-sm text-gray-700 uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          {badge != null && badge > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
          )}
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="px-5 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function DraftItemRow({ item, onRemove }: { item: LineItem; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 text-sm">
      <span className="font-mono text-xs text-gray-500 w-20 shrink-0">{item.modelId}</span>
      <span className="flex-1 text-gray-700 truncate">{item.modelLabel}</span>
      {item.billedLengthFt > 0 && (
        <span className="text-gray-400 text-xs whitespace-nowrap">{item.billedLengthFt}'</span>
      )}
      <span className="text-gray-500 font-medium whitespace-nowrap">
        ${item.listPrice.toFixed(2)}
      </span>
      <span className="text-gray-400 text-xs whitespace-nowrap">{item.weightLb} lb</span>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition ml-1">✕</button>
    </div>
  )
}

function FormRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 items-end">{children}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function CompatBanner({ text }: { text: string }) {
  return (
    <div className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-2">
      {text}
    </div>
  )
}

const selectCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ts-blue'
const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ts-blue w-20'
const addBtnCls = 'bg-ts-blue hover:bg-ts-teal text-white text-sm font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed'

// ─── SECTION: Enclosure ───────────────────────────────────────────────────────

interface EnclosureSectionProps {
  items: LineItem[]
  onAdd: (i: LineItem) => void
  onRemove: (id: string) => void
  onContextChange: (ctx: EnclosureCtx) => void
}

function EnclosureSection({ items, onAdd, onRemove, onContextChange }: EnclosureSectionProps) {
  const [family, setFamily] = useState<EnclosureFamily>('jvk')
  const [modelId, setModelId] = useState('')
  const [gauge, setGauge] = useState('')
  const [lengthFt, setLengthFt] = useState<number | ''>('')
  const [finish, setFinish] = useState<FinishOption>('prime')
  const [accSelections, setAccSelections] = useState<Record<string, { selected: boolean; qty: number }>>({})

  const catalog = ENCLOSURE_CATALOGS[family]
  const models = useMemo(() => getModelsForFamily(family), [family])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model: any = useMemo(() => models.find((m) => m.id === modelId), [models, modelId])
  const gauges: string[] = model?.available_gauges ?? []
  const accOptions: AccessoryOption[] = useMemo(() => model ? getAccessoryOptions(model) : [], [model])

  const availableFinishes: FinishOption[] = useMemo(() => {
    if (!model) return ['prime']
    const adders = model.finish_adders_per_ft ?? {}
    const opts: FinishOption[] = ['prime']
    if ('baked_powder' in adders) opts.push('baked_powder')
    if ('baked_metallic' in adders) opts.push('baked_metallic')
    if (catalog?._meta?.two_tone_adder_per_ft != null) opts.push('two_tone')
    return opts
  }, [model, catalog])

  const billedLen = typeof lengthFt === 'number' && lengthFt > 0
    ? roundToSterlingLength(lengthFt) : 0

  const preview = useMemo(() => {
    if (!model || billedLen === 0) return null
    const accs = Object.entries(accSelections)
      .filter(([, v]) => v.selected)
      .map(([key, v]) => ({ key, quantity: v.qty }))
    return calcEnclosurePrice({ catalog, model, gauge: gauge || undefined, billedLengthFt: billedLen, finish, accessories: accs })
  }, [model, gauge, billedLen, finish, accSelections, catalog])

  function handleFamilyChange(f: EnclosureFamily) {
    setFamily(f); setModelId(''); setGauge(''); setAccSelections({})
    onContextChange({ offset: null, heightIn: null, family: f })
  }

  function handleModelChange(id: string) {
    setModelId(id); setGauge(''); setAccSelections({})
    const m = models.find((m) => m.id === id)
    onContextChange({
      offset: offsetOfModel(m),
      heightIn: m?.height_in ?? null,
      family,
    })
  }

  function handleAdd() {
    if (!model || billedLen === 0) return
    const accs = Object.entries(accSelections)
      .filter(([, v]) => v.selected)
      .map(([key, v]) => {
        const opt = accOptions.find((o) => o.key === key)
        const qty = v.qty
        const unitPrice = opt?.unitListPrice ?? 0
        return { key, label: opt?.label ?? key, quantity: qty, unitListPrice: unitPrice, totalListPrice: unitPrice * qty }
      })
    onAdd({
      id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productFamily: 'enclosure',
      enclosureFamily: family,
      modelId: model.id,
      modelLabel: model.description ?? model.id,
      lengthFt: typeof lengthFt === 'number' ? lengthFt : billedLen,
      billedLengthFt: billedLen,
      finish,
      gauge: gauge || undefined,
      accessories: accs,
      listPrice: preview?.listPrice ?? 0,
      weightLb: preview?.weightLb ?? 0,
    })
    setModelId(''); setGauge(''); setLengthFt(''); setFinish('prime'); setAccSelections({})
    onContextChange({ offset: offsetOfModel(model), heightIn: model?.height_in ?? null, family })
  }

  return (
    <div className="space-y-3">
      <FormRow>
        <Field label="Family">
          <select className={selectCls} value={family} onChange={(e) => handleFamilyChange(e.target.value as EnclosureFamily)}>
            {ENCLOSURE_FAMILIES.map((f) => (
              <option key={f} value={f}>{ENCLOSURE_FAMILY_LABELS[f]}</option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <select className={selectCls} value={modelId} onChange={(e) => handleModelChange(e.target.value)}>
            <option value="">— Select model —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.id}{m.description ? ` – ${m.description}` : ''}</option>
            ))}
          </select>
        </Field>
        {gauges.length > 0 && (
          <Field label="Gauge">
            <select className={selectCls} value={gauge} onChange={(e) => setGauge(e.target.value)}>
              <option value="">—</option>
              {gauges.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        )}
        <Field label="Length (ft)">
          <input type="number" min={2} max={8} step={0.5} className={inputCls}
            placeholder="e.g. 6" value={lengthFt}
            onChange={(e) => setLengthFt(e.target.value === '' ? '' : parseFloat(e.target.value))}
          />
          {typeof lengthFt === 'number' && billedLen !== lengthFt && (
            <span className="text-xs text-amber-600">→ {billedLen}'</span>
          )}
        </Field>
        <Field label="Finish">
          <select className={selectCls} value={finish} onChange={(e) => setFinish(e.target.value as FinishOption)}>
            {availableFinishes.map((f) => <option key={f} value={f}>{FINISH_LABELS[f]}</option>)}
          </select>
        </Field>
        <div className="flex flex-col justify-end">
          {preview && (
            <span className="text-xs text-gray-500 mb-1">${preview.listPrice.toFixed(2)} · {preview.weightLb} lb</span>
          )}
          <button className={addBtnCls} disabled={!model || billedLen === 0} onClick={handleAdd}>
            + Add
          </button>
        </div>
      </FormRow>

      {/* Accessories */}
      {accOptions.length > 0 && model && (
        <div className="grid grid-cols-2 gap-1">
          {accOptions.map((opt) => {
            const sel = accSelections[opt.key]
            return (
              <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={sel?.selected ?? false}
                  onChange={(e) => setAccSelections((p) => ({
                    ...p, [opt.key]: { selected: e.target.checked, qty: p[opt.key]?.qty ?? 1 },
                  }))}
                  className="rounded"
                />
                <span className="text-gray-700 flex-1 truncate text-xs">{opt.label}</span>
                <span className="text-gray-400 text-xs">${opt.unitListPrice.toFixed(2)}{opt.isPricePerFt ? '/ft' : ' ea'}</span>
                {sel?.selected && (
                  <input
                    type="number" min={1} max={99}
                    className="w-10 border border-gray-300 rounded px-1 py-0.5 text-xs text-center"
                    value={sel.qty}
                    onChange={(e) => setAccSelections((p) => ({
                      ...p, [opt.key]: { ...p[opt.key], qty: parseInt(e.target.value) || 1 },
                    }))}
                  />
                )}
              </label>
            )
          })}
        </div>
      )}

      {items.map((item) => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

// ─── SECTION: Element ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ELEMENT_SERIES: { key: string; label: string; elements: any[] }[] = Object.entries(elementsData)
  .filter(([k]) => k !== '_meta')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .map(([key, val]: [string, any]) => ({
    key,
    label: (val._meta?.title as string) ?? key.replace(/_/g, ' '),
    elements: val.elements ?? [],
  }))

function ElementSection({ items, onAdd, onRemove, offset }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
  offset: Offset | null
}) {
  const [seriesKey, setSeriesKey] = useState(ELEMENT_SERIES[0]?.key ?? '')
  const [elementCat, setElementCat] = useState('')
  const [lengthFt, setLengthFt] = useState<number | ''>('')

  const seriesData = ELEMENT_SERIES.find((s) => s.key === seriesKey)

  const compatibleElements = useMemo(
    () => (seriesData?.elements ?? []).filter((e) => isElementCompatible(e, offset)),
    [seriesData, offset],
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = compatibleElements.find((e) => e.catalog_number === elementCat)

  // If current selection is no longer compatible, clear it
  const selectedIsCompat = !elementCat || compatibleElements.some((e) => e.catalog_number === elementCat)

  function handleAdd() {
    if (!element || !lengthFt) return
    const len = typeof lengthFt === 'number' ? lengthFt : 0
    const result = calcElementPrice(element.list_price_per_ft, element.weight_per_ft, len)
    onAdd({
      id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productFamily: 'element',
      modelId: element.catalog_number,
      modelLabel: `${element.fin_size ?? ''} ${element.fin_material ?? ''}`.trim(),
      lengthFt: len, billedLengthFt: len,
      finish: 'prime', accessories: [],
      listPrice: result.listPrice, weightLb: result.weightLb,
    })
    setElementCat(''); setLengthFt('')
  }

  const offLabel = offset === 'K' ? '≤ 2¾" fin depth' : offset === 'A' ? '≤ 3¼" fin depth' : offset === 'B' ? '4¼" fin depth' : null

  return (
    <div className="space-y-3">
      {offset && (
        <CompatBanner text={`Showing elements compatible with ${offset}-offset enclosure (${offLabel}). ${compatibleElements.length} of ${seriesData?.elements.length ?? 0} elements match.`} />
      )}
      <FormRow>
        <Field label="Series">
          <select className={selectCls} value={seriesKey} onChange={(e) => {
            setSeriesKey(e.target.value); setElementCat('')
          }}>
            {ELEMENT_SERIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Element">
          <select className={selectCls} value={selectedIsCompat ? elementCat : ''} onChange={(e) => setElementCat(e.target.value)}>
            <option value="">— Select —</option>
            {compatibleElements.map((e) => (
              <option key={e.catalog_number} value={e.catalog_number}>
                {e.catalog_number} – {e.fin_size} {e.fin_material} (${e.list_price_per_ft}/ft)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Length (ft)">
          <input type="number" min={2} max={20} step={0.5} className={inputCls}
            placeholder="e.g. 6" value={lengthFt}
            onChange={(e) => setLengthFt(e.target.value === '' ? '' : parseFloat(e.target.value))}
          />
        </Field>
        <div className="flex flex-col justify-end">
          {element && lengthFt && (
            <span className="text-xs text-gray-500 mb-1">
              ${(element.list_price_per_ft * (lengthFt as number)).toFixed(2)} · {(element.weight_per_ft * (lengthFt as number)).toFixed(1)} lb
            </span>
          )}
          <button className={addBtnCls} disabled={!element || !lengthFt} onClick={handleAdd}>+ Add</button>
        </div>
      </FormRow>
      {items.map((item) => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

// ─── SECTION: Rough-In ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ri = roughInData as any

interface RiItem {
  id: string; label: string; price: number; weight: number; offset?: Offset; heightIn?: number
}

const ROUGH_IN_CATEGORIES: {
  key: string; label: string; pricingUnit: 'per_each' | 'per_ft'
  offsetDependent: boolean; heightDependent: boolean; items: RiItem[]
}[] = [
  {
    key: 'full_backplates', label: 'Full Backplate', pricingUnit: 'per_ft', offsetDependent: false, heightDependent: true,
    items: ri.full_backplates.items.map((i: { catalog_number: string; height_in: number; list_price_per_ft_unpainted_galv: number; weight_per_ft: number }) => ({
      id: i.catalog_number,
      label: `${i.catalog_number} (${i.height_in}")`,
      price: i.list_price_per_ft_unpainted_galv,
      weight: i.weight_per_ft,
      heightIn: i.height_in,
    })),
  },
  {
    key: 'partial_backplate', label: 'Partial Backplate (PBP)', pricingUnit: 'per_ft', offsetDependent: false, heightDependent: false,
    items: [{ id: 'PBP', label: 'PBP – Partial Backplate', price: ri.partial_backplate.list_price_per_ft, weight: ri.partial_backplate.weight_per_ft }],
  },
  {
    key: 'mounting_strip', label: 'Mounting Strip (B-610)', pricingUnit: 'per_ft', offsetDependent: false, heightDependent: false,
    items: [{ id: 'B-610', label: 'B-610 – Mounting Strip', price: ri.mounting_strip.list_price_per_ft, weight: ri.mounting_strip.weight_per_ft }],
  },
  {
    key: 'water_brackets', label: 'Water Bracket', pricingUnit: 'per_each', offsetDependent: true, heightDependent: true,
    items: ri.water_brackets.items.map((i: { catalog_number: string; description: string; list_price: number; weight_lb: number; offset: Offset; height_in: number }) => ({
      id: i.catalog_number, label: `${i.catalog_number} – ${i.description}`, price: i.list_price, weight: i.weight_lb, offset: i.offset, heightIn: i.height_in,
    })),
  },
  {
    key: 'steam_brackets', label: 'Steam Bracket', pricingUnit: 'per_each', offsetDependent: true, heightDependent: true,
    items: ri.steam_brackets.items.map((i: { catalog_number: string; list_price: number; weight_lb: number; offset: Offset; height_in: number }) => ({
      id: i.catalog_number, label: i.catalog_number, price: i.list_price, weight: i.weight_lb, offset: i.offset, heightIn: i.height_in,
    })),
  },
  {
    key: 'ball_bearing_hangers', label: 'Ball Bearing Hanger', pricingUnit: 'per_each', offsetDependent: true, heightDependent: false,
    items: ri.ball_bearing_hangers.items.map((i: { catalog_number: string; description: string; list_price: number; weight_lb: number; offset: Offset }) => ({
      id: i.catalog_number, label: `${i.catalog_number} – ${i.description}`, price: i.list_price, weight: i.weight_lb, offset: i.offset,
    })),
  },
  {
    key: 'roll_pipe_hangers', label: 'Roll Pipe Hanger', pricingUnit: 'per_each', offsetDependent: true, heightDependent: false,
    items: ri.roll_pipe_hangers.items.map((i: { catalog_number: string; list_price: number; weight_lb: number; offset: Offset }) => ({
      id: i.catalog_number, label: i.catalog_number, price: i.list_price, weight: i.weight_lb, offset: i.offset,
    })),
  },
  {
    key: 'stand_offs', label: 'Stand-Off (B offset only)', pricingUnit: 'per_each', offsetDependent: true, heightDependent: true,
    items: ri.stand_offs.items.map((i: { catalog_number: string; description: string; list_price: number; weight_lb: number; enclosure_height_in: number }) => ({
      id: i.catalog_number, label: `${i.catalog_number} – ${i.description}`, price: i.list_price, weight: i.weight_lb, offset: 'B' as Offset, heightIn: i.enclosure_height_in,
    })),
  },
  {
    key: 'cradles', label: 'Cradle', pricingUnit: 'per_each', offsetDependent: false, heightDependent: false,
    items: ri.cradles.items.map((i: { catalog_number: string; description: string; list_price: number; weight_lb: number }) => ({
      id: i.catalog_number, label: `${i.catalog_number} – ${i.description}`, price: i.list_price, weight: i.weight_lb,
    })),
  },
  {
    key: 'gaskets', label: 'Urethane Gasket', pricingUnit: 'per_ft', offsetDependent: false, heightDependent: false,
    items: ri.gaskets.items.map((i: { catalog_number: string; description: string; list_price_per_ft: number; weight_per_ft: number }) => ({
      id: i.catalog_number, label: `${i.catalog_number} – ${i.description}`, price: i.list_price_per_ft, weight: i.weight_per_ft,
    })),
  },
  {
    key: 'touch_up_paint', label: 'Touch-Up Paint', pricingUnit: 'per_each', offsetDependent: false, heightDependent: false,
    items: [{ id: 'TUP', label: 'TUP – Touch-Up Paint Spray Can', price: ri.touch_up_paint.list_price, weight: ri.touch_up_paint.weight_lb }],
  },
]

// ─── Rough-In helpers ─────────────────────────────────────────────────────────

function findRiItem(catKey: string, pred: (i: RiItem) => boolean): RiItem | undefined {
  return ROUGH_IN_CATEGORIES.find(c => c.key === catKey)?.items.find(pred)
}

function makeRiLineItem(item: RiItem, qty: number, unit: 'per_each' | 'per_ft', lengthFt?: number): LineItem {
  const len = unit === 'per_ft' ? (lengthFt ?? 0) : 0
  const result = calcRoughInPrice(item.price, item.weight, qty, unit, len)
  return {
    id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productFamily: 'rough-in',
    modelId: item.id,
    modelLabel: item.label,
    lengthFt: len, billedLengthFt: len,
    finish: 'prime', accessories: [],
    listPrice: result.listPrice, weightLb: result.weightLb,
  }
}

function SmartRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-3 py-2.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-20 shrink-0">{label}</span>
      {children}
    </div>
  )
}

// Smart rough-in: shown when enclosure offset + height are known
function SmartRoughIn({ items, onAdd, onRemove, offset, heightIn, enclosureRunFt }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
  offset: Offset; heightIn: number; enclosureRunFt: number
}) {
  const recommendedBrackets = enclosureRunFt > 6 ? 3 : 2

  const fbp         = findRiItem('full_backplates',   i => i.heightIn === heightIn)
  const pbp         = findRiItem('partial_backplate', () => true)!
  const waterBkt    = findRiItem('water_brackets',    i => i.offset === offset && i.heightIn === heightIn)
  const steamBkt    = findRiItem('steam_brackets',    i => i.offset === offset && i.heightIn === heightIn)
  const bbHgrBrkt   = ROUGH_IN_CATEGORIES.find(c => c.key === 'ball_bearing_hangers')!.items.find(i => i.offset === offset && i.id.includes('BRKT'))
  const bbHgrWall   = ROUGH_IN_CATEGORIES.find(c => c.key === 'ball_bearing_hangers')!.items.find(i => i.offset === offset && i.id.includes('WALL'))
  const gasketFac   = findRiItem('gaskets', i => i.id === 'JV-UGFAC')!
  const gasketFld   = findRiItem('gaskets', i => i.id === 'JV-UGFLD')!
  const rollPipeHgr = findRiItem('roll_pipe_hangers', i => i.offset === offset)
  const soItem      = (offset === 'B' && (heightIn === 30 || heightIn === 36))
    ? findRiItem('stand_offs', i => i.heightIn === heightIn && i.id.includes('P'))
    : undefined
  const cr6a  = findRiItem('cradles', i => i.id === 'CR6A')!
  const cr10  = findRiItem('cradles', i => i.id === 'CR10')!
  const paint = findRiItem('touch_up_paint', () => true)!

  const [bpMode,     setBpMode]     = useState<'full' | 'partial'>('full')
  const [bpLen,      setBpLen]      = useState<number | ''>('')
  const [bktType,    setBktType]    = useState<'water' | 'steam'>(waterBkt ? 'water' : 'steam')
  const [bktQty,     setBktQty]     = useState(recommendedBrackets)
  const [hangerType, setHangerType] = useState<'bracket' | 'wall'>(bbHgrBrkt ? 'bracket' : 'wall')
  const [hangerQty,  setHangerQty]  = useState(recommendedBrackets)
  const [gasketMode, setGasketMode] = useState<'factory' | 'field'>('factory')
  const [gasketLen,  setGasketLen]  = useState<number | ''>('')
  const [rphQty,     setRphQty]     = useState(1)
  const [cr6aQty,    setCr6aQty]    = useState(1)
  const [cr10Qty,    setCr10Qty]    = useState(1)
  const [soQty,      setSoQty]      = useState(1)

  const bpItem     = bpMode     === 'full'     ? fbp      : pbp
  const bktItem    = bktType    === 'water'    ? waterBkt : steamBkt
  const hangerItem = hangerType === 'bracket'  ? bbHgrBrkt : bbHgrWall
  const gasketItem = gasketMode === 'factory'  ? gasketFac : gasketFld

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100">

        {/* Backplate */}
        <SmartRow label="Backplate">
          <select className={selectCls} value={bpMode} onChange={e => setBpMode(e.target.value as 'full' | 'partial')}>
            <option value="full">{fbp ? fbp.id : `FBP-${heightIn}`} – Full</option>
            <option value="partial">PBP – Partial</option>
          </select>
          {bpItem && <span className="text-xs text-gray-400">${bpItem.price.toFixed(2)}/ft</span>}
          <input type="number" min={0.5} step={0.5} className={inputCls} placeholder="ft"
            value={bpLen} onChange={e => setBpLen(e.target.value === '' ? '' : parseFloat(e.target.value))} />
          <button className={addBtnCls} onClick={() => { if (bpItem && bpLen) { onAdd(makeRiLineItem(bpItem, 1, 'per_ft', bpLen as number)); setBpLen('') } }} disabled={!bpLen}>+ Add</button>
        </SmartRow>

        {/* Bracket */}
        {(waterBkt || steamBkt) && (
          <SmartRow label="Bracket">
            <select className={selectCls} value={bktType} onChange={e => setBktType(e.target.value as 'water' | 'steam')}>
              {waterBkt && <option value="water">{waterBkt.id} – Water</option>}
              {steamBkt && <option value="steam">{steamBkt.id} – Steam</option>}
            </select>
            {bktItem && <span className="text-xs text-gray-400">${bktItem.price.toFixed(2)} ea</span>}
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={20} className={inputCls} value={bktQty}
                onChange={e => setBktQty(parseInt(e.target.value) || 1)} />
              <button className="text-xs text-ts-blue hover:text-ts-teal underline whitespace-nowrap"
                onClick={() => setBktQty(recommendedBrackets)}>
                rec: {recommendedBrackets}
              </button>
            </div>
            <button className={addBtnCls} onClick={() => bktItem && onAdd(makeRiLineItem(bktItem, bktQty, 'per_each'))}>+ Add</button>
          </SmartRow>
        )}

        {/* BB Hanger */}
        {(bbHgrBrkt || bbHgrWall) && (
          <SmartRow label="BB Hanger">
            <select className={selectCls} value={hangerType} onChange={e => setHangerType(e.target.value as 'bracket' | 'wall')}>
              {bbHgrBrkt && <option value="bracket">{bbHgrBrkt.id} – Bracket Mtd</option>}
              {bbHgrWall  && <option value="wall">{bbHgrWall.id} – Wall Mtd</option>}
            </select>
            {hangerItem && <span className="text-xs text-gray-400">${hangerItem.price.toFixed(2)} ea</span>}
            <input type="number" min={1} max={20} className={inputCls} value={hangerQty}
              onChange={e => setHangerQty(parseInt(e.target.value) || 1)} />
            <button className={addBtnCls} onClick={() => hangerItem && onAdd(makeRiLineItem(hangerItem, hangerQty, 'per_each'))}>+ Add</button>
          </SmartRow>
        )}

        {/* Gasket */}
        <SmartRow label="Gasket">
          <select className={selectCls} value={gasketMode} onChange={e => setGasketMode(e.target.value as 'factory' | 'field')}>
            <option value="factory">JV-UGFAC – Factory</option>
            <option value="field">JV-UGFLD – Field</option>
          </select>
          <span className="text-xs text-gray-400">${gasketItem.price.toFixed(2)}/ft</span>
          <input type="number" min={0.5} step={0.5} className={inputCls} placeholder="ft"
            value={gasketLen} onChange={e => setGasketLen(e.target.value === '' ? '' : parseFloat(e.target.value))} />
          <button className={addBtnCls} onClick={() => { if (gasketLen) { onAdd(makeRiLineItem(gasketItem, 1, 'per_ft', gasketLen as number)); setGasketLen('') } }} disabled={!gasketLen}>+ Add</button>
        </SmartRow>

        {/* Stand-offs — B offset, 30" or 36" only */}
        {soItem && (
          <SmartRow label="Stand-Off">
            <span className="text-xs text-gray-600">{soItem.id}</span>
            <span className="text-xs text-gray-400">${soItem.price.toFixed(2)} ea</span>
            <input type="number" min={1} max={20} className={inputCls} value={soQty}
              onChange={e => setSoQty(parseInt(e.target.value) || 1)} />
            <button className={addBtnCls} onClick={() => onAdd(makeRiLineItem(soItem, soQty, 'per_each'))}>+ Add</button>
          </SmartRow>
        )}
      </div>

      <p className="text-xs text-gray-400 italic px-1">
        Cradles 1, 2 &amp; 3A ship with element based on bracket/hanger count. CR6A &amp; CR10 are additional.
      </p>

      {/* Other quick-adds */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Other:</span>
        {rollPipeHgr && (
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1">
            <span className="text-xs text-gray-600">{rollPipeHgr.id}</span>
            <input type="number" min={1} className="w-8 text-center text-xs border-none outline-none"
              value={rphQty} onChange={e => setRphQty(parseInt(e.target.value) || 1)} />
            <button className="text-ts-blue hover:text-ts-teal text-xs font-bold"
              onClick={() => onAdd(makeRiLineItem(rollPipeHgr, rphQty, 'per_each'))}>+</button>
          </div>
        )}
        {([{ item: cr6a, qty: cr6aQty, setQty: setCr6aQty }, { item: cr10, qty: cr10Qty, setQty: setCr10Qty }] as Array<{ item: RiItem; qty: number; setQty: (n: number) => void }>).map(({ item, qty, setQty }) => (
          <div key={item.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1">
            <span className="text-xs text-gray-600">{item.id}</span>
            <input type="number" min={1} className="w-8 text-center text-xs border-none outline-none"
              value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
            <button className="text-ts-blue hover:text-ts-teal text-xs font-bold"
              onClick={() => onAdd(makeRiLineItem(item, qty, 'per_each'))}>+</button>
          </div>
        ))}
        <button className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:border-gray-400 transition"
          onClick={() => onAdd(makeRiLineItem(paint, 1, 'per_each'))}>
          {paint.id} +
        </button>
      </div>

      {items.map(item => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

// Generic rough-in picker: fallback when no enclosure context
function GenericRoughIn({ items, onAdd, onRemove, offset, heightIn }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
  offset: Offset | null; heightIn: number | null
}) {
  const [catKey,   setCatKey]   = useState(ROUGH_IN_CATEGORIES[0].key)
  const [itemId,   setItemId]   = useState('')
  const [qty,      setQty]      = useState<number>(1)
  const [lengthFt, setLengthFt] = useState<number | ''>('')

  const cat     = ROUGH_IN_CATEGORIES.find((c) => c.key === catKey)!
  const isPerFt = cat.pricingUnit === 'per_ft'

  const filteredItems = useMemo(() => {
    let result = cat.items
    if (cat.offsetDependent && offset) result = result.filter(i => i.offset === offset)
    if (cat.heightDependent  && heightIn) result = result.filter(i => i.heightIn === heightIn)
    return result
  }, [cat, offset, heightIn])

  const validSelection = filteredItems.find(i => i.id === itemId)

  function handleAdd() {
    if (!validSelection) return
    const len = isPerFt ? (typeof lengthFt === 'number' ? lengthFt : 0) : 1
    if (isPerFt && len === 0) return
    onAdd(makeRiLineItem(validSelection, qty, cat.pricingUnit, len))
    setItemId(''); setQty(1); setLengthFt('')
  }

  return (
    <div className="space-y-3">
      <FormRow>
        <Field label="Category">
          <select className={selectCls} value={catKey} onChange={e => { setCatKey(e.target.value); setItemId('') }}>
            {ROUGH_IN_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Item">
          <select className={selectCls} value={validSelection ? itemId : ''} onChange={e => setItemId(e.target.value)}>
            <option value="">— Select —</option>
            {filteredItems.map(i => (
              <option key={i.id} value={i.id}>{i.label} (${i.price.toFixed(2)}{isPerFt ? '/ft' : ' ea'})</option>
            ))}
          </select>
        </Field>
        {isPerFt ? (
          <Field label="Length (ft)">
            <input type="number" min={1} step={0.5} className={inputCls} placeholder="ft"
              value={lengthFt} onChange={e => setLengthFt(e.target.value === '' ? '' : parseFloat(e.target.value))} />
          </Field>
        ) : (
          <Field label="Qty">
            <input type="number" min={1} max={999} className={inputCls} value={qty}
              onChange={e => setQty(parseInt(e.target.value) || 1)} />
          </Field>
        )}
        <div className="flex flex-col justify-end">
          {validSelection && (isPerFt ? lengthFt : qty) && (
            <span className="text-xs text-gray-500 mb-1">
              ${(validSelection.price * (isPerFt ? (lengthFt as number) : qty)).toFixed(2)}
            </span>
          )}
          <button className={addBtnCls} disabled={!validSelection || (isPerFt && !lengthFt)} onClick={handleAdd}>+ Add</button>
        </div>
      </FormRow>
      {items.map(item => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

function RoughInSection({ items, onAdd, onRemove, offset, heightIn, enclosureRunFt }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
  offset: Offset | null; heightIn: number | null; enclosureRunFt: number
}) {
  if (offset && heightIn) {
    return <SmartRoughIn items={items} onAdd={onAdd} onRemove={onRemove}
      offset={offset} heightIn={heightIn} enclosureRunFt={enclosureRunFt} />
  }
  return <GenericRoughIn items={items} onAdd={onAdd} onRemove={onRemove} offset={offset} heightIn={heightIn} />
}

// ─── SECTION: Modifications ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mods = modsData as any

function ModsSection({ items, onAdd, onRemove, enclosureFamily }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
  enclosureFamily: EnclosureFamily | null
}) {
  const [modId, setModId] = useState('')
  const [offset, setOffset] = useState<Offset>('A')
  const [lengthFt, setLengthFt] = useState<number | ''>('')
  const [twoToneLen, setTwoToneLen] = useState<number | ''>('')

  const rwExcluded = enclosureFamily !== null && MODS_EXCLUDED_FAMILIES.includes(enclosureFamily)
  const encMods: { id: string; description: string; prices_per_ft_by_offset: Record<string, number> }[] = mods.enclosure_modifications

  function handleAddMod() {
    if (!modId || !lengthFt) return
    const mod = encMods.find((m) => m.id === modId)
    if (!mod) return
    const pricePerFt = mod.prices_per_ft_by_offset[offset] ?? 0
    const len = lengthFt as number
    onAdd({
      id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productFamily: 'modification',
      modelId: mod.id,
      modelLabel: `${mod.description} (${offset}-offset)`,
      lengthFt: len, billedLengthFt: len,
      finish: 'prime', accessories: [],
      listPrice: Math.round(pricePerFt * len * 100) / 100,
      weightLb: 0,
    })
    setModId(''); setLengthFt('')
  }

  function handleAddTwoTone() {
    if (!twoToneLen) return
    const len = twoToneLen as number
    onAdd({
      id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productFamily: 'modification',
      modelId: 'TWO-TONE',
      modelLabel: 'Two-Tone Effect (Aluminum Grille)',
      lengthFt: len, billedLengthFt: len,
      finish: 'prime', accessories: [],
      listPrice: Math.round(mods.finish_adders.two_tone_effect_adder_per_ft * len * 100) / 100,
      weightLb: 0,
    })
    setTwoToneLen('')
  }

  return (
    <div className="space-y-4">
      {/* RWLI / RWDB */}
      <div className="space-y-2">
        {rwExcluded && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
            RWLI and RWDB do not apply to {ENCLOSURE_FAMILY_LABELS[enclosureFamily!]} enclosures.
          </div>
        )}
        <FormRow>
          <Field label="Modification">
            <select className={selectCls} value={modId} onChange={(e) => setModId(e.target.value)} disabled={rwExcluded}>
              <option value="">— Select —</option>
              {encMods.map((m) => <option key={m.id} value={m.id}>{m.id} – {m.description}</option>)}
            </select>
          </Field>
          <Field label="Offset">
            <select className={selectCls} value={offset} onChange={(e) => setOffset(e.target.value as Offset)} disabled={rwExcluded}>
              <option value="K">K (3-9/16")</option>
              <option value="A">A (4-3/8")</option>
              <option value="B">B (5-5/16")</option>
            </select>
          </Field>
          <Field label="Length (ft)">
            <input type="number" min={1} step={0.5} className={inputCls} placeholder="ft"
              value={lengthFt} onChange={(e) => setLengthFt(e.target.value === '' ? '' : parseFloat(e.target.value))}
              disabled={rwExcluded} />
          </Field>
          <div className="flex flex-col justify-end">
            <button className={addBtnCls} disabled={rwExcluded || !modId || !lengthFt} onClick={handleAddMod}>+ Add</button>
          </div>
        </FormRow>
      </div>

      {/* Two-tone */}
      <FormRow>
        <Field label={`Two-Tone Effect (+$${mods.finish_adders.two_tone_effect_adder_per_ft}/ft)`}>
          <input type="number" min={1} step={0.5} className={inputCls} placeholder="ft"
            value={twoToneLen} onChange={(e) => setTwoToneLen(e.target.value === '' ? '' : parseFloat(e.target.value))} />
        </Field>
        <div className="flex flex-col justify-end">
          <button className={addBtnCls} disabled={!twoToneLen} onClick={handleAddTwoTone}>+ Add Two-Tone</button>
        </div>
      </FormRow>

      {items.map((item) => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

// ─── SECTION: Pipe Enclosure ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipe = pipeData as any

type PipeType = 'horizontal' | 'vertical' | 'column'
const PIPE_TYPES: { key: PipeType; label: string }[] = [
  { key: 'horizontal', label: 'PCH – Horizontal Pipe Cover' },
  { key: 'vertical', label: 'PCHV – Vertical Pipe Cover' },
  { key: 'column', label: 'SCE – Standard Column Enclosure Set' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPipeModels(type: PipeType): any[] {
  if (type === 'horizontal') return pipe.pipe_cover_horizontal.models
  if (type === 'vertical') return pipe.pipe_cover_vertical.models
  return pipe.standard_column_enclosure_sets.models
}

function PipeSection({ items, onAdd, onRemove }: {
  items: LineItem[]; onAdd: (i: LineItem) => void; onRemove: (id: string) => void
}) {
  const [pipeType, setPipeType] = useState<PipeType>('horizontal')
  const [modelId, setModelId] = useState('')
  const [lengthFt, setLengthFt] = useState<number | ''>('')
  const [qty, setQty] = useState(1)
  const [finish, setFinish] = useState<FinishOption>('prime')

  const models = getPipeModels(pipeType)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model: any = models.find((m) => m.id === modelId)
  const isSet = pipeType === 'column'
  const billedLen = !isSet && typeof lengthFt === 'number' && lengthFt > 0
    ? roundToSterlingLength(lengthFt) : 0

  function calcPipePrice(): { listPrice: number; weightLb: number } {
    if (!model) return { listPrice: 0, weightLb: 0 }
    if (isSet) {
      return { listPrice: model.list_price * qty, weightLb: (model.weight_lb ?? 0) * qty }
    }
    const lp = model.list_price_per_ft
    let pricePerFt = lp.prime ?? 0
    if (finish === 'baked_powder') pricePerFt += lp.add_baked_powder ?? 0
    if (finish === 'baked_metallic') pricePerFt += lp.add_baked_metallic ?? 0
    const wp = model.weight_per_ft?.prime ?? 0
    return {
      listPrice: Math.round(pricePerFt * billedLen * 100) / 100,
      weightLb: Math.round(wp * billedLen * 10) / 10,
    }
  }

  function handleAdd() {
    if (!model) return
    if (!isSet && billedLen === 0) return
    if (isSet && qty < 1) return
    const { listPrice, weightLb } = calcPipePrice()
    onAdd({
      id: `li-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productFamily: 'pipe-enclosure',
      modelId: model.id,
      modelLabel: model.description ?? model.id,
      lengthFt: isSet ? 0 : (typeof lengthFt === 'number' ? lengthFt : billedLen),
      billedLengthFt: isSet ? 0 : billedLen,
      finish, accessories: [], listPrice, weightLb,
      notes: isSet ? `Qty: ${qty}` : undefined,
    })
    setModelId(''); setLengthFt(''); setQty(1); setFinish('prime')
  }

  const preview = model ? calcPipePrice() : null

  return (
    <div className="space-y-3">
      <FormRow>
        <Field label="Type">
          <select className={selectCls} value={pipeType} onChange={(e) => {
            setPipeType(e.target.value as PipeType); setModelId('')
          }}>
            {PIPE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Model">
          <select className={selectCls} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">— Select —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.id}{m.description ? ` – ${m.description}` : ''}</option>
            ))}
          </select>
        </Field>
        {isSet ? (
          <Field label="Qty">
            <input type="number" min={1} className={inputCls} value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)} />
          </Field>
        ) : (
          <>
            <Field label="Length (ft)">
              <input type="number" min={2} max={8} step={0.5} className={inputCls} placeholder="ft"
                value={lengthFt} onChange={(e) => setLengthFt(e.target.value === '' ? '' : parseFloat(e.target.value))} />
              {typeof lengthFt === 'number' && billedLen !== lengthFt && (
                <span className="text-xs text-amber-600">→ {billedLen}'</span>
              )}
            </Field>
            <Field label="Finish">
              <select className={selectCls} value={finish} onChange={(e) => setFinish(e.target.value as FinishOption)}>
                <option value="prime">Prime</option>
                <option value="baked_powder">Baked Powder</option>
                <option value="baked_metallic">Baked Metallic</option>
              </select>
            </Field>
          </>
        )}
        <div className="flex flex-col justify-end">
          {preview && preview.listPrice > 0 && (
            <span className="text-xs text-gray-500 mb-1">${preview.listPrice.toFixed(2)} · {preview.weightLb} lb</span>
          )}
          <button className={addBtnCls} disabled={!model || (!isSet && billedLen === 0)} onClick={handleAdd}>+ Add</button>
        </div>
      </FormRow>
      {items.map((item) => (
        <DraftItemRow key={item.id} item={item} onRemove={() => onRemove(item.id)} />
      ))}
    </div>
  )
}

// ─── Main RoomBuilder ─────────────────────────────────────────────────────────

type RoomMode = 'standard' | 'element-only'

interface Props {
  jobId: string
  editingRoom?: Room
  onSave: (room: Room) => void
  onClose: () => void
}

export default function RoomBuilder({ editingRoom, onSave, onClose }: Props) {
  const [roomName, setRoomName] = useState(editingRoom?.name ?? '')
  const [draftItems, setDraftItems] = useState<LineItem[]>(editingRoom?.lineItems ?? [])
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['enclosure', 'element', 'rough-in', 'modification', 'pipe'])
  )
  const [roomMode, setRoomMode] = useState<RoomMode>('standard')
  const [encCtx, setEncCtx] = useState<EnclosureCtx>({ offset: null, heightIn: null, family: null })

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addItem(item: LineItem) { setDraftItems((prev) => [...prev, item]) }
  function removeItem(id: string) { setDraftItems((prev) => prev.filter((i) => i.id !== id)) }

  function handleSave() {
    onSave({
      id: editingRoom?.id ?? `room-${Date.now()}`,
      name: roomName.trim() || 'Unnamed Room',
      lineItems: draftItems,
    })
  }

  const itemsByFamily = (family: string) => draftItems.filter((i) => i.productFamily === family)
  const totalList = draftItems.reduce((s, i) => s + i.listPrice, 0)
  const totalWeight = draftItems.reduce((s, i) => s + i.weightLb, 0)

  // In element-only mode, pass null offset so no filtering is applied
  const activeOffset = roomMode === 'element-only' ? null : encCtx.offset
  const enclosureRunFt = draftItems
    .filter(i => i.productFamily === 'enclosure')
    .reduce((s, i) => s + i.billedLengthFt, 0)

  const hasEnclosureCtx = roomMode === 'standard' && encCtx.offset !== null

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div
        className="w-full max-w-3xl bg-white h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ts-blue"
              placeholder="Room name (e.g. Living Room, Office 201)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm px-2">Cancel</button>
            <button
              onClick={handleSave}
              className="bg-ts-blue hover:bg-ts-teal text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
            >
              {editingRoom ? 'Save Changes' : 'Add Room'}
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500 mr-2 text-xs">Room type:</span>
            <button
              onClick={() => setRoomMode('standard')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                roomMode === 'standard'
                  ? 'bg-ts-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              With Enclosure
            </button>
            <button
              onClick={() => setRoomMode('element-only')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                roomMode === 'element-only'
                  ? 'bg-ts-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Element Only
            </button>
          </div>

          {/* Context banner */}
          {roomMode === 'standard' && !encCtx.offset && (
            <p className="text-xs text-gray-400">
              Select an enclosure model above to filter compatible elements and brackets.
            </p>
          )}
          {hasEnclosureCtx && (
            <p className="text-xs text-blue-600">
              Filtering for <strong>{encCtx.offset}-offset</strong>
              {encCtx.heightIn ? `, ${encCtx.heightIn}"` : ''} enclosure
              {encCtx.family ? ` (${ENCLOSURE_FAMILY_LABELS[encCtx.family]})` : ''}.
            </p>
          )}
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* Enclosure — hidden in element-only mode */}
          {roomMode === 'standard' && (
            <SectionAccordion id="enclosure" title="Enclosure" badge={itemsByFamily('enclosure').length}
              open={openSections.has('enclosure')} onToggle={toggleSection}>
              <EnclosureSection
                items={itemsByFamily('enclosure')}
                onAdd={addItem}
                onRemove={removeItem}
                onContextChange={setEncCtx}
              />
            </SectionAccordion>
          )}

          <SectionAccordion id="element" title="Element (Fin Tube)" badge={itemsByFamily('element').length}
            open={openSections.has('element')} onToggle={toggleSection}>
            <ElementSection
              items={itemsByFamily('element')}
              onAdd={addItem}
              onRemove={removeItem}
              offset={activeOffset}
            />
          </SectionAccordion>

          <SectionAccordion id="rough-in" title="Rough-In" badge={itemsByFamily('rough-in').length}
            open={openSections.has('rough-in')} onToggle={toggleSection}>
            <RoughInSection
              items={itemsByFamily('rough-in')}
              onAdd={addItem}
              onRemove={removeItem}
              offset={activeOffset}
              heightIn={activeOffset ? encCtx.heightIn : null}
              enclosureRunFt={enclosureRunFt}
            />
          </SectionAccordion>

          <SectionAccordion id="modification" title="Modifications"
            badge={itemsByFamily('modification').length}
            open={openSections.has('modification')} onToggle={toggleSection}
            dimmed={roomMode === 'element-only'}>
            <ModsSection
              items={itemsByFamily('modification')}
              onAdd={addItem}
              onRemove={removeItem}
              enclosureFamily={encCtx.family}
            />
          </SectionAccordion>

          <SectionAccordion id="pipe" title="Pipe Enclosure" badge={itemsByFamily('pipe-enclosure').length}
            open={openSections.has('pipe')} onToggle={toggleSection}>
            <PipeSection items={itemsByFamily('pipe-enclosure')} onAdd={addItem} onRemove={removeItem} />
          </SectionAccordion>
        </div>

        {/* Footer summary */}
        {draftItems.length > 0 && (
          <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-500">{draftItems.length} item{draftItems.length !== 1 ? 's' : ''} · {totalWeight.toFixed(1)} lb</span>
            <span className="font-semibold text-gray-800">Room List: ${totalList.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
