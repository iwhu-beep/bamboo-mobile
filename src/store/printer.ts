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

  init: () => Promise<void>
  connect: (accountId: AccountId, session: BambuSession, devices: BambuDevice[]) => Promise<void>
  connectAll: () => Promise<void>
  disconnect: (accountId?: AccountId) => Promise<void>
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

    init: async () => {
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

      // 启动后自动连接已有账号（不使用 setTimeout，直接等待）
      await get().connectAll()
    },

    connect: async (accountId, session, devices) => {
      set({ error: null })
      try {
        const mqtt = getMqttManager()
        await mqtt.connect(accountId, session, devices.map((d) => d.dev_id))
        const states = mqtt.getStatesForAccount(accountId)
        set((prev) => ({
          states: { ...prev.states, [accountId]: states },
          connected: true
        }))
      } catch (err) {
        set({ error: (err as Error).message, connected: false })
        console.error(`[mqtt] connect failed for account=${accountId}`, err)
      }
    },

    connectAll: async () => {
      const accounts = useAuthStore.getState().accounts
      for (const acc of accounts) {
        await get().connect(acc.accountId, acc.session, acc.devices ?? [])
      }
    },

    disconnect: async (accountId) => {
      const mqtt = getMqttManager()
      await mqtt.disconnect(accountId)
      if (accountId) {
        set((prev) => {
          const states = { ...prev.states }
          delete states[accountId]
          return { states, connected: Object.keys(states).length > 0 }
        })
      } else {
        set({ connected: false })
      }
    },

    refreshDevices: async () => {
      try {
        // 重置状态并强制重新连接
        set({ states: {}, connected: false, error: null })
        await get().connectAll()
      } catch (err) {
        set({ error: (err as Error).message })
        console.error('[printer] refreshDevices connectAll failed', err)
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