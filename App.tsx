/**
 * Bamboo Mobile - 拓竹打印管家 iOS 版
 * App 入口
 */

import React, { useEffect } from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AppNavigator from './src/navigation/AppNavigator'
import { useAuthStore } from './src/store/auth'
import { usePrinterStore } from './src/store/printer'
import { useSettingsStore } from './src/store/settings'

const App: React.FC = () => {
  useEffect(() => {
    // 启动时加载持久化数据
    useAuthStore.getState().loadFromStorage()
    useSettingsStore.getState().loadFromStorage()
    usePrinterStore.getState().init()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigator />
    </SafeAreaProvider>
  )
}

export default App
