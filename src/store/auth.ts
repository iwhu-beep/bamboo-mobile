// ============================================================
// Auth Store —— 多账号认证状态管理
// ============================================================

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BambuRegion, BambuSession, BambuDevice, AccountId, AccountInfo, BambuUser } from '../shared/types'
import {
  apiGetDeviceList,
  apiGetProfile,
  postLogin,
  requestVerificationCode,
  extractUidFromToken,
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
  loginStep: 'idle' | 'credentials' | 'verifyCode' | 'tfa'
  pendingAccount: string
  pendingPassword: string
  pendingRegion: BambuRegion
  pendingChannel: 'email' | 'sms' | null

  // Actions
  login: (account: string, password: string, region: BambuRegion) => Promise<void>
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
  pendingPassword: '',
  pendingRegion: 'global',
  pendingChannel: null,

  login: async (account, password, region) => {
    set({ isLoading: true, error: null })
    try {
      const resp = await postLogin(region, { account, password })

      if (resp.loginType === 'verifyCode') {
        const channel = await requestVerificationCode(region, account)
        set({
          isLoading: false,
          loginStep: 'verifyCode',
          pendingAccount: account,
          pendingPassword: password,
          pendingRegion: region,
          pendingChannel: channel
        })
        return
      }

      if (resp.loginType === 'tfa') {
        set({
          isLoading: false,
          loginStep: 'tfa',
          pendingAccount: account,
          pendingPassword: password,
          pendingRegion: region
        })
        return
      }

      // 直接登录成功
      const session = await buildSession(region, account, resp)
      const devices = await apiGetDeviceList(session.accessToken, region)
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
          loginStep: 'idle'
        }
      })
      await get().saveToStorage()
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
          pendingPassword: '',
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
      pendingPassword: '',
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
