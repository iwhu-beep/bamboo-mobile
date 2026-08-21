// ============================================================
// 拓竹云 API —— 登录、设备、验证码
// ============================================================

import type {
  BambuDevice,
  BambuRegion,
  BambuSession,
  BambuUser
} from '../shared/types'
import { apiBase, buildHeaders, request, type LoginResp } from './client'

// ---------- 用户信息 ----------

interface ProfileResp {
  uid?: string
  username?: string
  name?: string
  avatar?: string
}

export async function apiGetProfile(accessToken: string, region: BambuRegion): Promise<BambuUser> {
  const data = await request<ProfileResp>(`${apiBase(region)}/v1/user-service/my/profile`, {
    token: accessToken
  })
  return {
    uid: data.uid ?? '',
    account: data.username ?? data.name ?? '',
    name: data.name ?? data.username,
    avatar: data.avatar
  }
}

// ---------- 设备列表 ----------

interface BindResp {
  devices?: Array<{
    dev_id: string
    name?: string
    online?: number | boolean
    dev_model_name?: string
    dev_product_name?: string
    dev_access_code?: string
    nozzle_diameter?: string
  }>
}

export async function apiGetDeviceList(
  accessToken: string,
  region: BambuRegion
): Promise<BambuDevice[]> {
  const data = await request<BindResp>(`${apiBase(region)}/v1/iot-service/api/user/bind`, {
    token: accessToken
  })
  return (data.devices ?? []).map((d) => ({
    dev_id: d.dev_id,
    name: d.name ?? d.dev_id,
    online: d.online === true || d.online === 1,
    print_status: '',
    dev_model_name: d.dev_model_name ?? '',
    dev_product_name: d.dev_product_name ?? '',
    dev_access_code: d.dev_access_code ?? '',
    nozzle_diameter: d.nozzle_diameter ?? '0.4'
  }))
}

// ---------- 验证码 ----------

export async function requestVerificationCode(
  region: BambuRegion,
  account: string
): Promise<'email' | 'sms'> {
  // 邮箱账号（含 @）→ 邮箱验证码
  if (account.includes('@')) {
    const res = await fetch(`${apiBase(region)}/v1/user-service/user/sendemail/code`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ account, type: 'codeLogin' })
    })
    if (!res.ok) {
      throw new Error(`邮箱验证码发送失败（HTTP ${res.status}），请稍后再试`)
    }
    return 'email'
  }

  // 手机号 → 短信验证码。body 字段必须用 phone
  const res = await fetch('https://api.bambulab.cn/v1/user-service/user/sendsmscode', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ phone: account, type: 'codeLogin' })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const robot = text.includes('robot') || text.includes('captcha')
    if (robot) {
      throw new Error('短信验证码发送被服务器风控拦截（需要人机验证）。请稍后再试，或改用密码登录。')
    }
    throw new Error(`短信验证码发送失败（HTTP ${res.status}），请检查手机号是否正确后重试`)
  }
  return 'sms'
}

// ---------- 登录 ----------

/**
 * 提交登录请求。
 * - 密码登录 body: { apiError: '', account, password }
 * - 验证码登录 body: { account, code } — 不带 password、不带 apiError
 */
export async function postLogin(
  region: BambuRegion,
  body: Record<string, unknown>,
  isCodeSubmit = false
): Promise<LoginResp> {
  const res = await fetch(`${apiBase(region)}/v1/user-service/user/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(
      typeof body.password === 'string' ? { apiError: '', ...body } : body
    )
  })
  const text = await res.text()
  let json: LoginResp | null = null
  try {
    json = JSON.parse(text) as LoginResp
  } catch {
    json = null
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const msg =
        (json?.message ?? json?.msg ?? '') ||
        (isCodeSubmit
          ? (json?.code === 2 ? '验证码错误' : '验证码不存在或已过期')
          : '账号或密码错误')
      throw new Error(msg)
    }
    throw new Error(`登录服务异常（HTTP ${res.status}），请稍后再试`)
  }
  if (!json) {
    throw new Error('登录响应解析失败')
  }
  return json
}

// ---------- JWT 解码 ----------

/**
 * 从 accessToken(JWT) 解码 uid —— MQTT 认证的权威来源。
 */
export function extractUidFromToken(token: string): string {
  try {
    const payload = token.split('.')[1]
    if (!payload) return ''
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64)) as Record<string, unknown>
    const username = String(json.username ?? json.uid ?? '')
    return username.startsWith('u_') ? username.slice(2) : username
  } catch {
    return ''
  }
}

// ---------- 构建会话 ----------

export async function buildSession(
  region: BambuRegion,
  account: string,
  resp: LoginResp
): Promise<BambuSession> {
  const accessToken = resp.accessToken ?? ''
  const refreshToken = resp.refreshToken ?? ''
  if (!accessToken || !refreshToken) {
    throw new Error('登录响应缺少令牌')
  }

  const uidFromToken = extractUidFromToken(accessToken)
  let user: BambuUser
  try {
    user = await apiGetProfile(accessToken, region)
  } catch {
    user = { uid: uidFromToken, account, name: account }
  }
  if (!user.uid && uidFromToken) {
    user.uid = uidFromToken
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: resp.expiresIn ?? 7776000,
    refreshExpiresIn: resp.refreshExpiresIn ?? 7776000,
    region,
    user: { ...user, account },
    loggedInAt: Date.now()
  }
}

// ---------- 登出 ----------

export async function apiLogout(session: BambuSession): Promise<void> {
  try {
    await fetch(`${apiBase(session.region)}/v1/user-service/my/logout`, {
      method: 'POST',
      headers: {
        ...buildHeaders(session.accessToken)
      },
      body: JSON.stringify({ refreshtoken: session.refreshToken })
    })
  } catch (err) {
    console.warn('[auth] logout request failed', err)
  }
}
