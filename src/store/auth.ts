// ============================================================
// Auth Store —— 短信验证码登录 + 多账号管理
// ============================================================

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BambuRegion, BambuSession, BambuDevice, AccountId, AccountInfo, BambuUser } from '../shared/types'
import {
  apiGetDeviceList,
  postLogin,
  requestVerificationCode,
  buildSession,
  apiLogout
} from '../api/cloud'

const STORAGE_KEY = '@bamboo_auth'

interface AuthState {
  accounts: AccountInfo[]
  activeAccountId: AccountId
  isLoading: boolean
  error: string | null

  // 登录流程状态
  loginStep: 'idle' | 'verifyCode'
  pendingAccount: string
  pendingRegion: BambuRegion
  pendingChannel: 'email' | 'sms' | null

  // Actions
  loginWithSms: (phone: string, region: BambuRegion) => Promise<void>
  submitCode: (code: string) => Promise<void>
  logout: (accountId?: AccountId) => Promise<void>
  removeAccount: (accountId: AccountId) => void
  switchAccount: (accountId: AccountId) => void
  resetLogin: () => void
  loadFromStorage: () => Promise<void>
  saveToStorage: () => Promise<void>
}

function accountIdOf(session: BambuSession): AccountId {
  return session.user.uid || session.user.account
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accounts: [],
  activeAccountId: '',
  isLoading: false,
  error: null,
  loginStep: 'idle',
  pendingAccount: '',
  pendingRegion: 'global',
  pendingChannel: null,

  loginWithSms: async (phone, region) => {
    set({ isLoading: true, error: null })
    try {
      const channel = await requestVerificationCode(region, phone)
      set({
        isLoading: false,
        loginStep: 'verifyCode',
        pendingAccount: phone,
        pendingRegion: region,
        pendingChannel: channel
      })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message })
    }
  },

  submitCode: async (code) => {
    const { pendingAccount, pendingRegion } = get()
    set({ isLoading: true, error: null })
    try {
      const resp = await postLogin(pendingRegion, { account: pendingAccount, code }, true)
      const session = await buildSession(pendingRegion, pendingAccount, resp)
      const devices = await apiGetDeviceList(session.accessToken, pendingRegion)
      const id = accountIdOf(session)

      set((prev) => {
        const existing = prev.accounts.findIndex((a) => a.accountId === id)
        const nextAccounts = [...prev.accounts]
        if (existing >= 0) {
          nextAccounts[existing] = { accountId: id, session, devices }
        } else {
          nextAccounts.push({ accountId: id, session, devices })
        }
        return {
          accounts: nextAccounts,
          activeAccountId: id,
          isLoading: false,
          loginStep: 'idle',
          pendingAccount: '',
          pendingChannel: null
        }
      })
      await get().saveToStorage()
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message })
    }
  },

  logout: async (accountId) => {
    const { accounts, activeAccountId } = get()
    const target = accounts.find((a) => a.accountId === (accountId ?? activeAccountId))
    if (target) {
      await apiLogout(target.session)
    }
    get().removeAccount(accountId ?? activeAccountId)
  },

  removeAccount: async (accountId) => {
    set((prev) => {
      const next = prev.accounts.filter((a) => a.accountId !== accountId)
      return {
        accounts: next,
        activeAccountId:
          prev.activeAccountId === accountId
            ? next[0]?.accountId ?? ''
            : prev.activeAccountId
      }
    })
    await get().saveToStorage()
  },

  switchAccount: (accountId) => {
    set({ activeAccountId: accountId })
    get().saveToStorage()
  },

  resetLogin: () => {
    set({
      loginStep: 'idle',
      pendingAccount: '',
      pendingChannel: null,
      error: null
    })
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as { accounts: AccountInfo[]; activeAccountId: string }
        set({
          accounts: data.accounts ?? [],
          activeAccountId: data.activeAccountId ?? ''
        })
      }
    } catch (err) {
      console.warn('[auth] loadFromStorage failed', err)
    }
  },

  saveToStorage: async () => {
    try {
      const { accounts, activeAccountId } = get()
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts, activeAccountId }))
    } catch (err) {
      console.warn('[auth] saveToStorage failed', err)
    }
  }
}))
