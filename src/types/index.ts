// ─── Product families ────────────────────────────────────────────────────────

export type ProductFamily =
  | 'element'
  | 'enclosure'
  | 'rough-in'
  | 'modification'
  | 'pipe-enclosure'

export type EnclosureFamily =
  | 'jvk'
  | 'jva'
  | 'jvb'
  | 'x-expanded'
  | 'lcs10-lb2'
  | 'classic-j'
  | 'classic-standard'
  | 'dura-vane'
  | 'guardian'

// ─── Finish options ───────────────────────────────────────────────────────────

export type FinishOption =
  | 'prime'
  | 'baked_powder'
  | 'baked_metallic'
  | 'two_tone'

// ─── A single accessory added to a line item ─────────────────────────────────

export interface SelectedAccessory {
  key: string
  label: string
  quantity: number
  unitListPrice: number
  totalListPrice: number
}

// ─── Line item ────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string
  productFamily: ProductFamily
  enclosureFamily?: EnclosureFamily
  modelId: string
  modelLabel: string
  lengthFt: number
  billedLengthFt: number
  finish: FinishOption
  gauge?: string
  accessories: SelectedAccessory[]
  listPrice: number
  weightLb: number
  notes?: string
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface Room {
  id: string
  name: string
  lineItems: LineItem[]
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface Job {
  id: string
  name: string
  customer: string
  createdAt: string
  rooms: Room[]
}
