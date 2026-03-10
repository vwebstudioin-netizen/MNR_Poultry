export type TransactionType = 'import' | 'export'

export type FeedCategory = 'corn' | 'soybean' | 'wheat' | 'premix' | 'rice-bran' | 'other'

export type EggCategory = 'white-egg' | 'brown-egg' | 'country-egg' | 'broken-egg' | 'other'

export interface FeedTransaction {
  id?: string
  type: TransactionType          // import = purchased/arrived | export = sold/sent out
  date: string                   // ISO date string
  category: FeedCategory
  quantityKg: number
  pricePerKg: number
  totalAmount: number
  party: string                  // supplier name (import) or buyer name (export)
  vehicleNo?: string
  invoiceNo?: string
  notes?: string
  createdAt?: string
}

export interface EggTransaction {
  id?: string
  type: TransactionType          // import = received from farm | export = sold/dispatched
  date: string
  category: EggCategory
  quantityTrays: number          // 1 tray = 30 eggs
  eggs: number                   // derived: quantityTrays * 30
  pricePerTray: number
  totalAmount: number
  party: string
  vehicleNo?: string
  invoiceNo?: string
  notes?: string
  createdAt?: string
}

export interface FeedStock {
  category: FeedCategory
  totalImportedKg: number
  totalExportedKg: number
  currentStockKg: number
}

export interface EggStock {
  category: EggCategory
  totalImportedTrays: number
  totalExportedTrays: number
  currentStockTrays: number
}

export interface DashboardStats {
  totalFeedImportedKg: number
  totalFeedExportedKg: number
  currentFeedStockKg: number
  totalEggImportedTrays: number
  totalEggExportedTrays: number
  currentEggStockTrays: number
  totalFeedRevenue: number       // from feed exports
  totalFeedCost: number          // from feed imports
  totalEggRevenue: number        // from egg exports
  totalEggCost: number           // from egg imports
}

export interface ChartDataPoint {
  date: string
  import: number
  export: number
}

// ─── Shed ────────────────────────────────────────────────────────────────────
export type ShedType   = 'broiler' | 'layer' | 'breeder' | 'chick' | 'other'
export type ShedStatus = 'active' | 'empty' | 'maintenance'

export interface Shed {
  id?: string
  name: string                   // e.g. "Shed A", "Shed 1"
  shedType: ShedType
  capacity: number               // max chickens the shed can hold
  currentCount: number           // live chicken count right now
  breed?: string                 // e.g. "Broiler Ross 308"
  placement?: string             // date chickens were placed (ISO)
  notes?: string
  status: ShedStatus
  createdAt?: string
  updatedAt?: string
}

export interface ChickenMovement {
  id?: string
  shedId: string
  shedName: string
  type: 'placement' | 'harvest' | 'mortality' | 'transfer'
  count: number
  date: string
  notes?: string
  createdAt?: string
}
