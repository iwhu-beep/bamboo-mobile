// ============================================================
// MQTT 管理器 —— React Native 移动端
// 使用 mqtt.js 的 WebSocket 传输（React Native 不支持原生 TCP）
// broker: wss://us.mqtt.bambulab.com:443 (cn: wss://cn.mqtt.bambulab.com:443)
// 凭据: username = u_<uid>，password = accessToken
// 主题: 订阅 device/<dev_id>/report，发布 device/<dev_id>/request
// ============================================================

import mqtt from 'mqtt'
import type { AccountId, BambuSession, PrinterState } from '../shared/types'
import { apiGetDeviceList, extractUidFromToken } from '../api/cloud'
import { parsePushStatus, type RawPushStatus } from './parser'

interface AccountMqtt {
  accountId: AccountId
  session: BambuSession
  client: mqtt.MqttClient | null
  deviceIds: string[]
  states: Map<string, PrinterState>
  deviceNames: Map<string, string>
  sequenceId: number
}

class MqttManager {
  private accounts = new Map<AccountId, AccountMqtt>()
  private deviceOwner = new Map<string, AccountId>()

  /** 状态变化回调 */
  onStateChange: ((accountId: AccountId, state: PrinterState) => void) | null = null
  /** 在线状态变化回调 */
  onOnlineChange: ((accountId: AccountId, deviceId: string, online: boolean) => void) | null = null

  getStates(): Record<string, PrinterState> {
    const out: Record<string, PrinterState> = {}
    for (const acc of this.accounts.values()) {
      for (const [id, state] of acc.states) {
        out[id] = state
      }
    }
    return out
  }

  getStatesForAccount(accountId: AccountId): Record<string, PrinterState> {
    const acc = this.accounts.get(accountId)
    if (!acc) return {}
    const out: Record<string, PrinterState> = {}
    for (const [id, state] of acc.states) {
      out[id] = state
    }
    return out
  }

  getAccountIdForDevice(deviceId: string): AccountId | undefined {
    return this.deviceOwner.get(deviceId)
  }

  /** 发布任务控制命令 */
  publishCommand(deviceId: string, command: string, extra?: Record<string, unknown>): Promise<void> {
    const accountId = this.deviceOwner.get(deviceId)
    const acc = accountId ? this.accounts.get(accountId) : undefined
    const payload: Record<string, unknown> = {
      print: { sequence_id: acc ? this.nextSeq(acc) : '0', command, ...(extra ?? {}) }
    }
    return this.publish(deviceId, payload)
  }

  private nextSeq(acc: AccountMqtt): string {
    acc.sequenceId += 1
    return String(acc.sequenceId)
  }

  /** 发布控制命令 */
  private publish(deviceId: string, payload: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const accountId = this.deviceOwner.get(deviceId)
      const acc = accountId ? this.accounts.get(accountId) : undefined
      if (!acc || !acc.client || !acc.client.connected) {
        reject(new Error('MQTT 未连接'))
        return
      }
      acc.client.publish(
        `device/${deviceId}/request`,
        JSON.stringify(payload),
        { qos: 1 },
        (err?: Error) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  /** 连接并订阅指定账号的一批设备 */
  connect(accountId: AccountId, session: BambuSession, deviceIds: string[]): void {
    let acc = this.accounts.get(accountId)

    if (!acc) {
      acc = {
        accountId,
        session,
        client: null,
        deviceIds: [],
        states: new Map(),
        deviceNames: new Map(),
        sequenceId: 20001
      }
      this.accounts.set(accountId, acc)
    }
    acc.session = session
    acc.deviceIds = deviceIds

    // 记录设备 -> 账号归属
    for (const id of deviceIds) {
      this.deviceOwner.set(id, accountId)
    }

    // 异步拉取设备名
    apiGetDeviceList(session.accessToken, session.region)
      .then((devices) => {
        const a = this.accounts.get(accountId)
        if (!a) return
        for (const d of devices) a.deviceNames.set(d.dev_id, d.name)
      })
      .catch((err) => console.warn('[mqtt] fetch device names failed', err))

    if (acc.client && acc.client.connected) {
      this.subscribeDevices(acc, deviceIds)
      return
    }

    // 断开旧连接
    if (acc.client) {
      acc.client.end(true)
      acc.client = null
    }

    const broker = session.region === 'cn'
      ? 'wss://cn.mqtt.bambulab.com:443'
      : 'wss://us.mqtt.bambulab.com:443'

    const uid = extractUidFromToken(session.accessToken) || accountId
    const clientId = `bamboo_${accountId}_${Math.random().toString(16).slice(2, 8)}`

    const client = mqtt.connect(broker, {
      username: `u_${uid}`,
      password: session.accessToken,
      clientId,
      keepalive: 30,
      protocolVersion: 4,
      connectTimeout: 15000,
      reconnectPeriod: 5000,
      clean: true,
      rejectUnauthorized: true
    })

    acc.client = client

    client.on('connect', () => {
      console.log(`[mqtt] account=${accountId} connected to ${broker}`)
      this.subscribeDevices(acc!, deviceIds)
    })

    client.on('reconnect', () => {
      console.log(`[mqtt] account=${accountId} reconnecting…`)
    })

    client.on('error', (err) => {
      console.error(`[mqtt] account=${accountId} error`, err)
      const code = (err as Error & { code?: number }).code
      if (code === 5) {
        // 令牌失效
        this.disconnect(accountId)
      }
    })

    client.on('offline', () => {
      console.log(`[mqtt] account=${accountId} offline`)
      const a = this.accounts.get(accountId)
      if (!a) return
      for (const id of a.deviceIds) {
        const s = a.states.get(id)
        if (s) {
          const next = { ...s, online: false }
          a.states.set(id, next)
          this.onOnlineChange?.(accountId, id, false)
        }
      }
    })

    client.on('message', (topic, payload) => {
      try {
        this.handleMessage(accountId, topic, payload)
      } catch (err) {
        console.error(`[mqtt] account=${accountId} handleMessage error`, err)
      }
    })
  }

  private subscribeDevices(acc: AccountMqtt, deviceIds: string[]): void {
    if (!acc.client) return
    for (const id of deviceIds) {
      acc.client.subscribe(`device/${id}/report`, { qos: 0 }, (err) => {
        if (err) console.error(`[mqtt] subscribe ${id} failed`, err)
      })
      this.requestPushall(acc, id)
    }
  }

  private requestPushall(acc: AccountMqtt, deviceId: string): void {
    this.publish(deviceId, { pushing: { sequence_id: this.nextSeq(acc), command: 'pushall' } }).catch((e) =>
      console.warn(`[mqtt] pushall ${deviceId} failed`, e)
    )
  }

  private handleMessage(accountId: AccountId, topic: string, payload: Buffer | string): void {
    const m = topic.match(/^device\/(.+)\/report$/)
    if (!m) return
    const deviceId = m[1]
    try {
      const data = typeof payload === 'string' ? payload : payload.toString()
      const json = JSON.parse(data) as RawPushStatus
      this.handleReport(accountId, deviceId, json)
    } catch (err) {
      console.error(`[mqtt] parse error`, err)
    }
  }

  private handleReport(accountId: AccountId, deviceId: string, json: RawPushStatus): void {
    const acc = this.accounts.get(accountId)
    if (!acc) return

    // 事件帧
    const event = json['event'] as { event?: string } | undefined
    if (event && event.event) {
      if (event.event === 'client.connected') {
        const prev = acc.states.get(deviceId)
        if (prev) {
          const next = { ...prev, online: true, lastSeen: Date.now() }
          acc.states.set(deviceId, next)
          this.onStateChange?.(accountId, next)
          this.onOnlineChange?.(accountId, deviceId, true)
        }
        this.requestPushall(acc, deviceId)
      } else if (event.event === 'client.disconnected') {
        const prev = acc.states.get(deviceId)
        if (prev) {
          const next = { ...prev, online: false, lastSeen: Date.now() }
          acc.states.set(deviceId, next)
          this.onStateChange?.(accountId, next)
          this.onOnlineChange?.(accountId, deviceId, false)
        }
      }
      return
    }

    const print = json['print'] as Record<string, unknown> | undefined
    if (!print || print['command'] !== 'push_status') return

    const prev = acc.states.get(deviceId) ?? null
    const next = parsePushStatus(deviceId, print, prev)
    acc.states.set(deviceId, next)
    this.onStateChange?.(accountId, next)
  }

  /** 断开指定账号（缺省断开全部） */
  disconnect(accountId?: AccountId): void {
    const targets = accountId ? [accountId] : [...this.accounts.keys()]
    for (const id of targets) {
      const acc = this.accounts.get(id)
      if (!acc) continue
      if (acc.client) {
        acc.client.end(true)
        acc.client = null
      }
      this.accounts.delete(id)
    }
    if (!accountId) this.deviceOwner.clear()
  }
}

let manager: MqttManager | null = null

export function getMqttManager(): MqttManager {
  if (!manager) manager = new MqttManager()
  return manager
}
