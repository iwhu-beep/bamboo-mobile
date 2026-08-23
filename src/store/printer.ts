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
      console.log('[printer] init: setting up MQTT callbacks')

      mqtt.onStateChange = (accountId, state) => {
        console.log('[printer] onStateChange:', accountId, state.deviceId, state.state)
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
        console.log('[printer] onOnlineChange:', accountId, deviceId, online)
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

      // 记录当前账号信息用于调试
      const accounts = useAuthStore.getState().accounts
      console.log('[printer] init: found', accounts.length, 'accounts')
      for (const acc of accounts) {
        console.log('[printer] init: account', acc.accountId, 'devices:', acc.devices?.length || 0)
      }

      // 启动后自动连接已有账号（不使用 setTimeout，直接等待）
      console.log('[printer] init: starting connectAll')
      await get().connectAll()
      console.log('[printer] init: connectAll completed')
    },

    connect: async (accountId, session, devices) => {
      set({ error: null })
      console.log('[printer] connect: starting for account=', accountId, 'devices=', devices.length)
      try {
        const mqtt = getMqttManager()
        console.log('[printer] connect: calling mqtt.connect')
        await mqtt.connect(accountId, session, devices.map((d) => d.dev_id))
        console.log('[printer] connect: mqtt.connect completed')

        const states = mqtt.getStatesForAccount(accountId)
        console.log('[printer] connect: got states', states)

        set((prev) => ({
          states: { ...prev.states, [accountId]: states },
          connected: true
        }))
        console.log('[printer] connect: state updated, connected=true')
      } catch (err) {
        set({ error: (err as Error).message, connected: false })
        console.error('[printer] connect failed for account=', accountId, err)
      }
    },

    connectAll: async () => {
      const accounts = useAuthStore.getState().accounts
      console.log('[printer] connectAll: starting for', accounts.length, 'accounts')
      for (const acc of accounts) {
        console.log('[printer] connectAll: processing account', acc.accountId, 'devices:', acc.devices?.length || 0)
        await get().connect(acc.accountId, acc.session, acc.devices ?? [])
        console.log('[printer] connectAll: completed account', acc.accountId)
      }
      console.log('[printer] connectAll: completed all accounts')
    },

    disconnect: async (accountId) => {
      const mqtt = getMqttManager()
      console.log('[printer] disconnect: disconnecting account', accountId)
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
      console.log('[printer] disconnect: completed')
    },

    refreshDevices: async () => {
      try {
        console.log('[printer] refreshDevices: resetting state and reconnecting')
        // 重置状态并强制重新连接
        set({ states: {}, connected: false, error: null })
        await get().connectAll()
        console.log('[printer] refreshDevices: completed')
      } catch (err) {
        set({ error: (err as Error).message })
        console.error('[printer] refreshDevices connectAll failed', err)
      }
    },

    pause: async (deviceId) => {
      console.log('[printer] pause:', deviceId)
      await getMqttManager().publishCommand(deviceId, 'pause')
    },
    resume: async (deviceId) => {
      console.log('[printer] resume:', deviceId)
      await getMqttManager().publishCommand(deviceId, 'resume')
    },
    stop: async (deviceId) => {
      console.log('[printer] stop:', deviceId)
      await getMqttManager().publishCommand(deviceId, 'stop')
    },
    setSpeed: async (deviceId, level) => {
      console.log('[printer] setSpeed:', deviceId, level)
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