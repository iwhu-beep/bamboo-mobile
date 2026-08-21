// ============================================================
// LoginScreen —— 短信验证码登录
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
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

const CODE_RESEND_SECONDS = 60

const LoginScreen: React.FC = () => {
  const {
    loginWithSms,
    submitCode,
    resetLogin,
    isLoading,
    error,
    loginStep,
    pendingChannel
  } = useAuthStore()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [region, setRegion] = useState<BambuRegion>('cn')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    resetLogin()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [loginStep === 'idle']) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendCode = async () => {
    if (!phone.trim()) return
    await loginWithSms(phone.trim(), region)
    setCountdown(CODE_RESEND_SECONDS)
  }

  const handleSubmitCode = async () => {
    if (!code.trim()) return
    await submitCode(code.trim())
  }

  const codeSent = loginStep === 'verifyCode'

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

          {/* Phone Input */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="手机号码"
              placeholderTextColor="#9e9e9e"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={15}
              editable={!codeSent}
            />

            {/* Send Code Button */}
            {!codeSent && (
              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  (!phone.trim() || isLoading || countdown > 0) && styles.loginBtnDisabled
                ]}
                onPress={handleSendCode}
                disabled={!phone.trim() || isLoading || countdown > 0}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginBtnText}>
                    {countdown > 0 ? `${countdown}s 后重新发送` : '获取验证码'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Code Input */}
            {codeSent && (
              <>
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
                  autoFocus
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
                    <Text style={styles.loginBtnText}>登录</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={resetLogin} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>更换手机号</Text>
                </TouchableOpacity>
              </>
            )}

            {!codeSent && error && <Text style={styles.errorText}>{error}</Text>}
          </View>
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
