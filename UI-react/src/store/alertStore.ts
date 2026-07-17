import { create } from 'zustand'

// Puerto de alertService.js -- cola global de alertas (banner arriba de
// ng-view), autodescarte a los 10s.
export interface Alert {
  id: number
  type: 'info' | 'danger'
  msg: string
}

let nextId = 1

interface AlertState {
  alerts: Alert[]
  addAlert: (type: Alert['type'], msg: string) => void
  addDangerAlert: (msg: string) => void
  addInfoAlert: (msg: string) => void
  closeAlert: (id: number) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (type, msg) => {
    const id = nextId++
    set((state) => ({ alerts: [...state.alerts, { id, type, msg }] }))
    setTimeout(() => {
      set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }))
    }, 10000)
  },
  addDangerAlert: (msg) => useAlertStore.getState().addAlert('danger', msg),
  addInfoAlert: (msg) => useAlertStore.getState().addAlert('info', msg),
  closeAlert: (id) => set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}))
