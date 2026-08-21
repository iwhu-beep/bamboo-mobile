// ============================================================
// HTTP 客户端 —— 拓竹云 API 请求
// ============================================================

const API_BASE: Record<string, string> = {
  global: 'https://api.bambulab.com',
  cn: 'https://api.bambulab.cn'
}

export function apiBase(region: string): string {
  return API_BASE[region] ?? API_BASE.global
}

/**
 * 拓竹云请求头 —— 必须与官方 OrcaSlicer/bambu_network_agent 完全一致，
 * 缺头会被 WAF 识别为非官方客户端并返回 HTTP 418（I'm a teapot）。
 */
export function buildHeaders(token?: string): Record<string, string> {
  return {
    'User-Agent': 'bambu_network_agent/01.09.05.01',
    'X-BBL-Client-Name': 'OrcaSlicer',
    'X-BBL-Client-Type': 'slicer',
    'X-BBL-Client-Version': '01.09.05.51',
    'X-BBL-Language': 'en-US',
    'X-BBL-OS-Type': 'linux',
    'X-BBL-OS-Version': '6.2.0',
    'X-BBL-Agent-Version': '01.09.05.01',
    'X-BBL-Executable-info': '{}',
    'X-BBL-Agent-OS-Type': 'linux',
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export interface LoginResp {
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  refreshExpiresIn?: number
  loginType?: 'verifyCode' | 'tfa'
  tfaKey?: string
  message?: string
  msg?: string
  code?: number
}

export async function request<T>(
  url: string,
  init: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: buildHeaders(init.token),
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (!res.ok) {
    const msg =
      (json as Record<string, unknown>)?.message ??
      (json as Record<string, unknown>)?.msg ??
      `HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return json as T
}
