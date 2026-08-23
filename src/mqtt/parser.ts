// ============================================================
// push_status 消息解析
// 消息结构: { print: { command: "push_status", msg: 0|1, ...字段 } }
// msg=0 全量消息（直接替换），msg=1 差分消息（合并到已有状态）
// ============================================================

import type {
  AmsInfo,
  AmsTray,
  AmsUnit,
  GcodeState,
  HmsEntry,
  PrinterState
} from '../shared/types'

export interface RawPushStatus {
  print?: Record<string, unknown>
  event?: { event?: string }
}

const STATE_MAP: Record<string, GcodeState> = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSE: 'PAUSE',
  FINISH: 'FINISH',
  FAILED: 'FAILED',
  PREPARE: 'PREPARE',
  SLICING: 'SLICING',
  INIT: 'INIT'
}

function parseWifiSignal(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const m = raw.match(/-?\d+/)
  return m ? Number(m[0]) : null
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}

function parseHms(raw: unknown): HmsEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h): h is { attr: number; code: number } => typeof h === 'object' && h !== null)
    .map((h) => ({
      attr: num(h.attr),
      code: num(h.code)
    }))
}

function parseAms(raw: unknown): AmsInfo | null {
  if (typeof raw !== 'object' || raw === null) return null
  const ams = raw as Record<string, unknown>
  const unitsRaw = ams['units']
  let units: AmsUnit[] = []
  if (Array.isArray(unitsRaw)) {
    units = unitsRaw
      .filter((u): u is Record<string, unknown> => typeof u === 'object' && u !== null)
      .map((u, i) => {
        const traysRaw = u['tray']
        const trays: AmsTray[] = Array.isArray(traysRaw)
          ? traysRaw
              .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
              .map((t, j) => ({
                id: String(i * 4 + j),
                type: str(t['type']),
                color: str(t['color']),
                remain: num(t['remain']),
                nozzleTempMin: num(t['nozzle_temp_min']),
                nozzleTempMax: num(t['nozzle_temp_max']),
                diameter: str(t['diameter']),
                weight: str(t['weight'])
              }))
          : []
        return {
          id: String(i),
          temp: num(u['temp']),
          humidity: num(u['hum']),
          trays
        }
      })
  }

  let vtTray: AmsTray | null = null
  const vtRaw = ams['vt_tray']
  if (typeof vtRaw === 'object' && vtRaw !== null) {
    const vt = vtRaw as Record<string, unknown>
    vtTray = {
      id: 'vt',
      type: str(vt['type']),
      color: str(vt['color']),
      remain: num(vt['remain']),
      nozzleTempMin: num(vt['nozzle_temp_min']),
      nozzleTempMax: num(vt['nozzle_temp_max']),
      diameter: str(vt['diameter']),
      weight: str(vt['weight'])
    }
  }

  return {
    units,
    existsBits: str(ams['ams_exist_bits']),
    trayExistBits: str(ams['tray_exist_bits']),
    trayNow: num(ams['tray_now']),
    vtTray,
    rfidStatus: num(ams['rfid_status']),
    status: num(ams['ams_status'])
  }
}

/**
 * 解析单条 push_status 消息。
 */
export function parsePushStatus(
  deviceId: string,
  print: Record<string, unknown>,
  prev: PrinterState | null
): PrinterState {
  const isDiff = print['msg'] === 1
  const base: PrinterState = prev ?? {
    deviceId,
    online: true,
    lastSeen: Date.now(),
    state: 'IDLE',
    progress: 0,
    remainingTimeMin: 0,
    currentLayer: 0,
    totalLayer: 0,
    temps: { nozzle: 0, nozzleTarget: 0, bed: 0, bedTarget: 0, chamber: null },
    printError: 0,
    hms: [],
    spdLvl: 2,
    spdMag: 100,
    gcodeFile: '',
    taskId: '',
    subtaskName: '',
    wifiSignal: null,
    sdcardState: 0,
    ams: null,
    stageCur: 0,
    fanGear: 0
  }

  const p = print
  const next: PrinterState = isDiff ? { ...base } : { ...base, hms: [], ams: null }

  if (p['gcode_state'] !== undefined) {
    const mappedState = STATE_MAP[str(p['gcode_state']).toUpperCase()]
    next.state = mappedState ?? str(p['gcode_state']).toUpperCase() ?? 'IDLE'
  }
  if (p['mc_percent'] !== undefined) next.progress = num(p['mc_percent'])
  if (p['mc_remaining_time'] !== undefined) next.remainingTimeMin = num(p['mc_remaining_time'])
  if (p['layer_num'] !== undefined) next.currentLayer = num(p['layer_num'])
  if (p['total_layer_num'] !== undefined) next.totalLayer = num(p['total_layer_num'])
  if (p['stg_cur'] !== undefined) next.stageCur = num(p['stg_cur'])
  if (p['print_error'] !== undefined) next.printError = num(p['print_error'])
  if (p['spd_lvl'] !== undefined) next.spdLvl = num(p['spd_lvl'])
  if (p['spd_mag'] !== undefined) next.spdMag = num(p['spd_mag'])
  if (p['gcode_file'] !== undefined) next.gcodeFile = str(p['gcode_file'])
  if (p['task_id'] !== undefined) next.taskId = str(p['task_id'])
  if (p['subtask_name'] !== undefined) next.subtaskName = str(p['subtask_name'])
  if (p['wifi_signal'] !== undefined) next.wifiSignal = parseWifiSignal(p['wifi_signal'])
  if (p['sd'] !== undefined) next.sdcardState = num(p['sd'])
  if (p['fan_gear'] !== undefined) next.fanGear = num(p['fan_gear'])

  // HMS 错误
  const hmsRaw = p['hms']
  if (Array.isArray(hmsRaw) && hmsRaw.length > 0) {
    next.hms = parseHms(hmsRaw)
  }

  // 温度：旧机型顶层字段
  const temps = { ...next.temps }
  if (p['nozzle_temper'] !== undefined) temps.nozzle = num(p['nozzle_temper'])
  if (p['nozzle_target_temper'] !== undefined) temps.nozzleTarget = num(p['nozzle_target_temper'])
  if (p['bed_temper'] !== undefined) temps.bed = num(p['bed_temper'])
  if (p['bed_target_temper'] !== undefined) temps.bedTarget = num(p['bed_target_temper'])
  if (p['chamber_temper'] !== undefined) temps.chamber = num(p['chamber_temper'])

  // 新机型（H2D/P2S/X2C）：打包温度
  const device = p['device'] as Record<string, unknown> | undefined
  if (device && typeof device === 'object') {
    const bed = device['bed'] as Record<string, unknown> | undefined
    if (bed && typeof bed === 'object') {
      const bedInfo = bed['info'] as Record<string, unknown> | undefined
      const bedTemp = bedInfo?.['temp']
      if (typeof bedTemp === 'number') {
        temps.bed = bedTemp & 0xffff
        temps.bedTarget = (bedTemp >> 16) & 0xffff
      }
    }
    const extruder = device['extruder'] as Record<string, unknown> | undefined
    const extruderInfo = extruder?.['info']
    if (Array.isArray(extruderInfo) && extruderInfo.length > 0) {
      const e0 = extruderInfo[0] as Record<string, unknown> | undefined
      if (e0 && typeof e0['temp'] === 'number') {
        const t = e0['temp'] as number
        temps.nozzle = t & 0xffff
        temps.nozzleTarget = (t >> 16) & 0xffff
      }
    }
  }
  next.temps = temps

  // AMS
  const amsRaw = p['ams']
  if (amsRaw !== undefined && amsRaw !== null) {
    const parsed = parseAms(amsRaw)
    if (parsed) next.ams = parsed
  }

  next.lastSeen = Date.now()
  next.online = true
  return next
}
