// ============================================================
// AppNavigator —— React Navigation 配置
// ============================================================

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { AccountId } from '../shared/types'
import { useAuthStore } from '../store/auth'
import LoginScreen from '../screens/login/LoginScreen'
import DeviceListScreen from '../screens/devices/DeviceListScreen'
import DeviceDetailScreen from '../screens/detail/DeviceDetailScreen'

export type RootStackParamList = {
  Login: undefined
  DeviceList: undefined
  DeviceDetail: {
    accountId: AccountId
    deviceId: string
    deviceName: string
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const AppNavigator: React.FC = () => {
  const accounts = useAuthStore((s) => s.accounts)
  const isLoggedIn = accounts.length > 0

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isLoggedIn ? 'DeviceList' : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1976d2',
          headerTitleStyle: { fontWeight: '600' }
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DeviceList"
          component={DeviceListScreen}
          options={{ title: '拓竹打印管家' }}
        />
        <Stack.Screen
          name="DeviceDetail"
          component={DeviceDetailScreen}
          options={({ route }) => ({
            title: route.params.deviceName
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator
