// ============================================================
// DeviceDetailScreen —— 设备详情页面
// ============================================================

import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePrinterState, usePrinterStore } from '../../store/printer'
import type { AccountId, PrinterState } from '../../shared/types'
import { STATE_LABELS, STATE_COLORS, SPEED_LABELS } from '../../shared/types'
import StatusBadge from '../../components/StatusBadge'

interface Props {
  route: {
    params: {
      accountId: AccountId
      deviceId: string
      deviceName: string
    }
  }
}

// ---------- 温度卡片 ----------
const TempCard: React.FC<{ label: string; current: number; target: number }> = ({
  label,
  current,
  target
}) => (
  <View style={styles.tempCard}>
    <Text style={styles.tempLabel}>{label}</Text>
    <Text style={styles.tempValue}>
      {current.toFixed(0)}°C
      {target > 0 ? ` → ${target.toFixed(0)}°C` : ''}
    </Text>
  </View>
)

// ---------- AMS 色块 ----------
const AmsDot: React.FC<{
  color: string
  type: string
  remain: number
}> = ({ color, type, remain }) => (
  <View style={styles.amsItem}>
    <View style={[styles.amsDot, { backgroundColor: color || '#9e9e9e' }]} />
    <Text style={styles.amsType}>{type}</Text>
    <Text style={styles.amsRemain}>{remain}%</Text>
  </View>
)

// ---------- 主组件 ----------
const DeviceDetailScreen: React.FC<Props> = ({ route }) => {
  const { accountId, deviceId } = route.params
  const state = usePrinterState(accountId, deviceId)
  const { pause, resume, stop, setSpeed } = usePrinterStore()

  if (!state) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isPrinting = state.state === 'RUNNING'
  const isPaused = state.state === 'PAUSE'

  const handlePauseResume = async () => {
    try {
      if (isPrinting) await pause(deviceId)
      else if (isPaused) await resume(deviceId)
    } catch (err) {
      Alert.alert('操作失败', (err as Error).message)
    }
  }

  const handleStop = () => {
    Alert.alert('停止打印', '确定要停止当前打印任务吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '停止',
        style: 'destructive',
        onPress: async () => {
          try {
            await stop(deviceId)
          } catch (err) {
            Alert.alert('操作失败', (err as Error).message)
          }
        }
      }
    ])
  }

  const handleSpeed = async (level: number) => {
    try {
      await setSpeed(deviceId, level)
    } catch (err) {
      Alert.alert('操作失败', (err as Error).message)
    }
  }

  // 格式化剩余时间
  const formatTime = (minutes: number) => {
    if (minutes <= 0) return '--'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0) return `${h}小时${m}分`
    return `${m}分`
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 状态头 */}
        <View style={styles.statusHeader}>
          <StatusBadge state={state.state} online={state.online} />
          {state.subtaskName ? (
            <Text style={styles.taskName} numberOfLines={1}>{state.subtaskName}</Text>
          ) : null}
        </View>

        {/* 进度区 */}
        {(isPrinting || isPaused || state.state === 'FINISH') && (
          <View style={styles.section}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPercent}>{state.progress}%</Text>
            </View>
            <View style={styles.progressInfo}>
              <View style={styles.progressInfoRow}>
                <Text style={styles.progressLabel}>剩余时间</Text>
                <Text style={styles.progressValue}>{formatTime(state.remainingTimeMin)}</Text>
              </View>
              <View style={styles.progressInfoRow}>
                <Text style={styles.progressLabel}>层数</Text>
                <Text style={styles.progressValue}>
                  {state.currentLayer > 0 ? `${state.currentLayer}/${state.totalLayer}` : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 温度区 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>温度</Text>
          <View style={styles.tempRow}>
            <TempCard
              label="喷头"
              current={state.temps.nozzle}
              target={state.temps.nozzleTarget}
            />
            <TempCard
              label="热床"
              current={state.temps.bed}
              target={state.temps.bedTarget}
            />
            {state.temps.chamber !== null && (
              <TempCard
                label="腔体"
                current={state.temps.chamber}
                target={0}
              />
            )}
          </View>
        </View>

        {/* AMS 区 */}
        {state.ams && state.ams.units.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AMS 耗材</Text>
            {state.ams.units.map((unit) => (
              <View key={unit.id} style={styles.amsUnit}>
                <Text style={styles.amsUnitLabel}>
                  AMS {unit.id} · {unit.temp}°C · 湿度 {unit.humidity}%
                </Text>
                <View style={styles.amsTrays}>
                  {unit.trays.map((tray) => (
                    <AmsDot
                      key={tray.id}
                      color={tray.color}
                      type={tray.type}
                      remain={tray.remain}
                    />
                  ))}
                </View>
              </View>
            ))}
            {state.ams.vtTray && (
              <View style={styles.amsUnit}>
                <Text style={styles.amsUnitLabel}>外置料盘</Text>
                <View style={styles.amsTrays}>
                  <AmsDot
                    color={state.ams.vtTray.color}
                    type={state.ams.vtTray.type}
                    remain={state.ams.vtTray.remain}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* 控制区 */}
        {(isPrinting || isPaused) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任务控制</Text>
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={[styles.controlBtn, styles.controlBtnPrimary]}
                onPress={handlePauseResume}
              >
                <Text style={styles.controlBtnText}>
                  {isPrinting ? '暂停' : '继续'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, styles.controlBtnDanger]}
                onPress={handleStop}
              >
                <Text style={[styles.controlBtnText, { color: '#f44336' }]}>停止</Text>
              </TouchableOpacity>
            </View>

            {/* 速度选择 */}
            <Text style={styles.speedLabel}>打印速度</Text>
            <View style={styles.speedRow}>
              {[1, 2, 3, 4].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.speedBtn,
                    state.spdLvl === level && styles.speedBtnActive
                  ]}
                  onPress={() => handleSpeed(level)}
                >
                  <Text
                    style={[
                      styles.speedBtnText,
                      state.spdLvl === level && styles.speedBtnTextActive
                    ]}
                  >
                    {SPEED_LABELS[level]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* HMS 错误 */}
        {state.hms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>错误信息</Text>
            {state.hms.map((hms, i) => (
              <View key={i} style={styles.hmsItem}>
                <Text style={styles.hmsCode}>
                  HMS {hms.attr.toString(16).toUpperCase()}:{hms.code.toString(16).toUpperCase()}
                </Text>
                {hms.text ? <Text style={styles.hmsText}>{hms.text}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* WiFi 信号 */}
        {state.wifiSignal !== null && (
          <View style={styles.section}>
            <Text style={styles.infoRow}>
              WiFi 信号: {state.wifiSignal} dBm
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  scrollContent: {
    padding: 16,
    gap: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: '#757575'
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    color: '#757575'
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121'
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center'
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2196f3'
  },
  progressInfo: {
    gap: 8
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressLabel: {
    fontSize: 14,
    color: '#757575'
  },
  progressValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500'
  },
  tempRow: {
    flexDirection: 'row',
    gap: 8
  },
  tempCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  tempLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4
  },
  tempValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121'
  },
  amsUnit: {
    gap: 8
  },
  amsUnitLabel: {
    fontSize: 13,
    color: '#616161'
  },
  amsTrays: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  amsItem: {
    alignItems: 'center',
    gap: 4
  },
  amsDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  amsType: {
    fontSize: 11,
    color: '#616161'
  },
  amsRemain: {
    fontSize: 11,
    color: '#9e9e9e'
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  controlBtnPrimary: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2'
  },
  controlBtnDanger: {
    backgroundColor: '#ffffff'
  },
  controlBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff'
  },
  speedLabel: {
    fontSize: 13,
    color: '#757575'
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  speedBtnActive: {
    backgroundColor: '#1976d2'
  },
  speedBtnText: {
    fontSize: 13,
    color: '#616161'
  },
  speedBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600'
  },
  hmsItem: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  hmsCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e65100'
  },
  hmsText: {
    fontSize: 12,
    color: '#bf360c'
  },
  infoRow: {
    fontSize: 14,
    color: '#757575'
  }
})

export default DeviceDetailScreen
