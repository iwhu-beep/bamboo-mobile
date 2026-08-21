// ============================================================
// Settings Store —— 应用设置
// ============================================================

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BambuRegion } from '../shared/types'

const STORAGE_KEY = '@bamboo_settings'

interface AppSettings {
  region: BambuRegion
  notifyPrintDone: boolean
  notifyPrintFailed: boolean
}

interface SettingsState {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  loadFromStorage: () => Promise<void>
  saveToStorage: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    region: 'global',
    notifyPrintDone: true,
    notifyPrintFailed: true
  },

  updateSettings: async (partial) => {
    set((prev) => ({
      settings: { ...prev.settings, ...partial }
    }))
    await get().saveToStorage()
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as AppSettings
        set({ settings: data })
      }
    } catch (err) {
      console.warn('[settings] loadFromStorage failed', err)
    }
  },

  saveToStorage: async () => {
    try {
      const { settings } = get()
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (err) {
      console.warn('[settings] saveToStorage failed', err)
    }
  }
}))
