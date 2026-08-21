// ============================================================
// Printer Store —— 打印机实时状态管理
// ============================================================

import { create } from 'zustand'
import type { AccountId, BambuDevice, BambuSession, PrinterState } from '../shared/types'
import { getMqttManager } from '../mqtt/manager'
import { useAuthStore } from './auth'

interface PrinterStoreState {
  states: Record<AccountId, Record<string, PrinterState>>
  connected: boolean
  error: string | null

  init: () => void
  connect: (accountId: AccountId, session: BambuSession, devices: BambuDevice[]) => void
  connectAll: () => void
  disconnect: (accountId?: AccountId) => void
  refreshDevices: () => Promise<void>

  // 任务控制
  pause: (deviceId: string) => Promise<void>
  resume: (deviceId: string) => Promise<void>
  stop: (deviceId: string) => Promise<void>
  setSpeed: (deviceId: string, level: number) => Promise<void>
}

export const usePrinterStore = create<PrinterStoreState>((set, get) => {
  let initialized = false

  return {
    states: {},
    connected: false,
    error: null,

    init: () => {
      if (initialized) return
      initialized = true

      const mqtt = getMqttManager()
      mqtt.onStateChange = (accountId, state) => {
        set((prev) => {
          const bucket = prev.states[accountId] ?? {}
          return {
            states: {
              ...prev.states,
              [accountId]: { ...bucket, [state.deviceId]: state }
            }
          }
        })
      }
      mqtt.onOnlineChange = (accountId, deviceId, online) => {
        set((prev) => {
          const bucket = prev.states[accountId] ?? {}
          const cur = bucket[deviceId]
          if (!cur) return prev
          return {
            states: {
              ...prev.states,
              [accountId]: {
                ...bucket,
                [deviceId]: { ...cur, online }
              }
            }
          }
        })
      }

      // 启动后自动连接已有账号
      setTimeout(() => get().connectAll(), 500)
    },

    connect: (accountId, session, devices) => {
      set({ error: null })
      if (devices.length === 0) return
      try {
        const mqtt = getMqttManager()
        mqtt.connect(accountId, session, devices.map((d) => d.dev_id))
        const states = mqtt.getStatesForAccount(accountId)
        set((prev) => ({
          states: { ...prev.states, [accountId]: states },
          connected: true
        }))
      } catch (err) {
        set({ error: (err as Error).message, connected: false })
      }
    },

    connectAll: async () => {
      const accounts = useAuthStore.getState().accounts
      for (const acc of accounts) {
        if (acc.devices.length > 0) {
          get().connect(acc.accountId, acc.session, acc.devices)
        }
      }
    },

    disconnect: (accountId) => {
      const mqtt = getMqttManager()
      mqtt.disconnect(accountId)
      if (accountId) {
        set((prev) => {
          const states = { ...prev.states }
          delete states[accountId]
          return { states, connected: false }
        })
      } else {
        set({ connected: false })
      }
    },

    refreshDevices: async () => {
      try {
        // 直接使用 auth store 中的 accounts
        const authAccounts = useAuthStore.getState().accounts
        if (authAccounts.some((a) => a.devices.length > 0)) {
          get().connectAll()
        }
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },

    pause: async (deviceId) => {
      await getMqttManager().publishCommand(deviceId, 'pause')
    },
    resume: async (deviceId) => {
      await getMqttManager().publishCommand(deviceId, 'resume')
    },
    stop: async (deviceId) => {
      await getMqttManager().publishCommand(deviceId, 'stop')
    },
    setSpeed: async (deviceId, level) => {
      await getMqttManager().publishCommand(deviceId, 'print', { param: level })
    }
  }
})

/** 获取指定账号 + 设备的状态 */
export const usePrinterState = (
  accountId: AccountId | undefined,
  deviceId: string
): PrinterState | null =>
  usePrinterStore((s) => {
    if (!accountId) return null
    return s.states[accountId]?.[deviceId] ?? null
  })
