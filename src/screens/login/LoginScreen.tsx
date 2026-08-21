// ============================================================
// LoginScreen —— 登录页面
// ============================================================

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth'
import type { BambuRegion } from '../../shared/types'

const LoginScreen: React.FC = () => {
  const {
    login,
    submitCode,
    resetLogin,
    isLoading,
    error,
    loginStep,
    pendingChannel
  } = useAuthStore()

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [region, setRegion] = useState<BambuRegion>('cn')

  useEffect(() => {
    resetLogin()
  }, [])

  const handleLogin = async () => {
    if (!account.trim() || !password.trim()) return
    await login(account.trim(), password.trim(), region)
  }

  const handleSubmitCode = async () => {
    if (!code.trim()) return
    await submitCode(code.trim())
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🖨️</Text>
            <Text style={styles.title}>拓竹打印管家</Text>
            <Text style={styles.subtitle}>Bamboo Print Manager</Text>
          </View>

          {/* Region Toggle */}
          <View style={styles.regionRow}>
            <TouchableOpacity
              style={[styles.regionBtn, region === 'cn' && styles.regionBtnActive]}
              onPress={() => setRegion('cn')}
            >
              <Text style={[styles.regionText, region === 'cn' && styles.regionTextActive]}>
                中国版
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regionBtn, region === 'global' && styles.regionBtnActive]}
              onPress={() => setRegion('global')}
            >
              <Text style={[styles.regionText, region === 'global' && styles.regionTextActive]}>
                国际版
              </Text>
            </TouchableOpacity>
          </View>

          {loginStep === 'idle' || loginStep === 'credentials' ? (
            /* Credential Form */
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="手机号或邮箱"
                placeholderTextColor="#9e9e9e"
                value={account}
                onChangeText={setAccount}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor="#9e9e9e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginBtnText}>登录</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Verify Code Form */
            <View style={styles.form}>
              <Text style={styles.codeHint}>
                验证码已发送至{pendingChannel === 'email' ? '邮箱' : '手机'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="输入验证码"
                placeholderTextColor="#9e9e9e"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                onPress={handleSubmitCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginBtnText}>验证</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={resetLogin} style={styles.backBtn}>
                <Text style={styles.backBtnText}>返回登录</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  logoIcon: {
    fontSize: 60,
    marginBottom: 12
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121'
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4
  },
  regionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12
  },
  regionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e0e0e0'
  },
  regionBtnActive: {
    backgroundColor: '#1976d2'
  },
  regionText: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '500'
  },
  regionTextActive: {
    color: '#ffffff'
  },
  form: {
    gap: 12
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  loginBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4
  },
  codeHint: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 12
  },
  backBtnText: {
    color: '#1976d2',
    fontSize: 14
  }
})

export default LoginScreen
