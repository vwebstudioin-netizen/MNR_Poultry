import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  doc,
  where,
  updateDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { FeedTransaction, EggTransaction, Shed, ChickenMovement } from '@/types'

// ─── Collections ────────────────────────────────────────────────────────────
const FEED_COL = 'feed_transactions'
const EGG_COL  = 'egg_transactions'

// ─── Feed ─────────────────────────────────────────────────────────────────
export async function addFeedTransaction(data: Omit<FeedTransaction, 'id' | 'createdAt'>) {
  return addDoc(collection(db, FEED_COL), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function getFeedTransactions(type?: 'import' | 'export'): Promise<FeedTransaction[]> {
  let q = type
    ? query(collection(db, FEED_COL), where('type', '==', type), orderBy('date', 'desc'))
    : query(collection(db, FEED_COL), orderBy('date', 'desc'))

  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as FeedTransaction
  })
}

export async function deleteFeedTransaction(id: string) {
  return deleteDoc(doc(db, FEED_COL, id))
}

export async function updateFeedTransaction(id: string, data: Partial<FeedTransaction>) {
  return updateDoc(doc(db, FEED_COL, id), data)
}

// ─── Eggs ─────────────────────────────────────────────────────────────────
export async function addEggTransaction(data: Omit<EggTransaction, 'id' | 'createdAt'>) {
  return addDoc(collection(db, EGG_COL), {
    ...data,
    eggs: data.quantityTrays * 30,
    createdAt: serverTimestamp(),
  })
}

export async function getEggTransactions(type?: 'import' | 'export'): Promise<EggTransaction[]> {
  let q = type
    ? query(collection(db, EGG_COL), where('type', '==', type), orderBy('date', 'desc'))
    : query(collection(db, EGG_COL), orderBy('date', 'desc'))

  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as EggTransaction
  })
}

export async function deleteEggTransaction(id: string) {
  return deleteDoc(doc(db, EGG_COL, id))
}

export async function updateEggTransaction(id: string, data: Partial<EggTransaction>) {
  return updateDoc(doc(db, EGG_COL, id), data)
}

// ─── Sheds ────────────────────────────────────────────────────────────────────
const SHED_COL     = 'sheds'
const MOVEMENT_COL = 'chicken_movements'

export async function addShed(data: Omit<Shed, 'id' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, SHED_COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getSheds(): Promise<Shed[]> {
  const snap = await getDocs(query(collection(db, SHED_COL), orderBy('name', 'asc')))
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    } as Shed
  })
}

export async function updateShed(id: string, data: Partial<Shed>) {
  return updateDoc(doc(db, SHED_COL, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteShed(id: string) {
  return deleteDoc(doc(db, SHED_COL, id))
}

// ─── Chicken Movements ────────────────────────────────────────────────────────
export async function addChickenMovement(data: Omit<ChickenMovement, 'id' | 'createdAt'>) {
  return addDoc(collection(db, MOVEMENT_COL), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function getChickenMovements(shedId?: string): Promise<ChickenMovement[]> {
  const q = shedId
    ? query(collection(db, MOVEMENT_COL), where('shedId', '==', shedId), orderBy('date', 'desc'))
    : query(collection(db, MOVEMENT_COL), orderBy('date', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as ChickenMovement
  })
}
