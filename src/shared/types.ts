// ============================================================
// 共享类型定义 —— React Native 移动端
// ============================================================

// ---------- 区域 ----------
export type BambuRegion = 'global' | 'cn'

// ---------- 云账号会话 ----------
export interface BambuUser {
  uid: string
  account: string
  name?: string
  avatar?: string
}

export interface BambuSession {
  accessToken: string
  refreshToken: string
  expiresIn: number // 秒
  refreshExpiresIn: number
  region: BambuRegion
  user: BambuUser
  loggedInAt: number
}

/** 账号唯一标识 = user.uid */
export type AccountId = string

/** 已登录账号（会话 + 该账号设备列表） */
export interface AccountInfo {
  accountId: AccountId
  session: BambuSession
  devices: BambuDevice[]
}

/** 登录流程返回值 */
export type LoginChallengeType = 'verifyCode' | 'tfa'

/** 验证码渠道 */
export type CodeChannel = 'email' | 'sms'

export type LoginResult =
  | { type: 'ok'; session: BambuSession }
  | { type: 'challenge'; challenge: LoginChallengeType; tfaKey?: string; channel?: CodeChannel }

// ---------- 设备 ----------
export interface BambuDevice {
  dev_id: string
  name: string
  online: boolean
  print_status: string
  dev_model_name: string
  dev_product_name: string
  dev_access_code: string
  nozzle_diameter: string
}

// ---------- 打印机实时状态 ----------
export type GcodeState =
  | 'IDLE'
  | 'RUNNING'
  | 'PAUSE'
  | 'FINISH'
  | 'FAILED'
  | 'PREPARE'
  | 'SLICING'
  | 'INIT'

export interface HmsEntry {
  attr: number
  code: number
  text?: string
}

export interface AmsTray {
  id: string
  type: string
  color: string
  remain: number
  nozzleTempMin: number
  nozzleTempMax: number
  diameter: string
  weight: string
}

export interface AmsUnit {
  id: string
  temp: number
  humidity: number
  trays: AmsTray[]
}

export interface AmsInfo {
  units: AmsUnit[]
  existsBits: string
  trayExistBits: string
  trayNow: number
  vtTray?: AmsTray | null
  rfidStatus: number
  status: number
}

export interface PrinterTemps {
  nozzle: number
  nozzleTarget: number
  bed: number
  bedTarget: number
  chamber: number | null
}

export interface PrinterState {
  deviceId: string
  online: boolean
  lastSeen: number
  state: GcodeState
  progress: number
  remainingTimeMin: number
  currentLayer: number
  totalLayer: number
  temps: PrinterTemps
  printError: number
  hms: HmsEntry[]
  spdLvl: number
  spdMag: number
  gcodeFile: string
  taskId: string
  subtaskName: string
  wifiSignal: number | null
  sdcardState: number
  ams: AmsInfo | null
  stageCur: number
  fanGear: number
}

// ---------- 状态中文映射 ----------
export const STATE_LABELS: Record<GcodeState, string> = {
  IDLE: '待机',
  RUNNING: '打印中',
  PAUSE: '暂停',
  FINISH: '完成',
  FAILED: '失败',
  PREPARE: '准备中',
  SLICING: '切片中',
  INIT: '初始化'
}

export const STATE_COLORS: Record<GcodeState, string> = {
  IDLE: '#9e9e9e',
  RUNNING: '#2196f3',
  PAUSE: '#ff9800',
  FINISH: '#4caf50',
  FAILED: '#f44336',
  PREPARE: '#9c27b0',
  SLICING: '#9c27b0',
  INIT: '#9c27b0'
}

// ---------- 速度等级 ----------
export const SPEED_LABELS: Record<number, string> = {
  1: '静音',
  2: '标准',
  3: '运动',
  4: '竞技'
}
