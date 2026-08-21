// ============================================================
// DeviceListScreen —— 设备列表页面
// ============================================================

import React, { useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth'
import { usePrinterStore, usePrinterState } from '../../store/printer'
import type { BambuDevice, AccountId, PrinterState } from '../../shared/types'
import StatusBadge from '../../components/StatusBadge'

// ---------- 设备卡片 ----------
interface DeviceCardProps {
  accountId: AccountId
  device: BambuDevice
  onPress: () => void
}

const DeviceCard: React.FC<DeviceCardProps> = ({ accountId, device, onPress }) => {
  const state = usePrinterState(accountId, device.dev_id)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>{device.name}</Text>
          <StatusBadge
            state={state?.state ?? 'IDLE'}
            online={device.online}
          />
        </View>
        <Text style={styles.cardModel}>{device.dev_model_name || device.dev_product_name || '未知型号'}</Text>
      </View>

      {state && (
        <View style={styles.cardBody}>
          {/* 进度 */}
          {state.state === 'RUNNING' && (
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${state.progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{state.progress}%</Text>
            </View>
          )}

          {/* 温度 */}
          <View style={styles.tempRow}>
            <Text style={styles.tempText}>
              喷头 {state.temps.nozzle.toFixed(0)}°C
            </Text>
            <Text style={styles.tempText}>
              热床 {state.temps.bed.toFixed(0)}°C
            </Text>
          </View>

          {/* AMS */}
          {state.ams && state.ams.units.length > 0 && (
            <View style={styles.amsRow}>
              {state.ams.units.map((unit) =>
                unit.trays.map((tray) => (
                  <View
                    key={tray.id}
                    style={[styles.amsDot, { backgroundColor: tray.color || '#9e9e9e' }]}
                  />
                ))
              )}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

// ---------- 设备列表 ----------
const DeviceListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const accounts = useAuthStore((s) => s.accounts)
  const logout = useAuthStore((s) => s.logout)
  const refreshDevices = usePrinterStore((s) => s.refreshDevices)
  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshDevices()
    setRefreshing(false)
  }, [])

  // 所有设备（跨账号）
  const allDevices: Array<{ accountId: AccountId; device: BambuDevice }> = accounts.flatMap((acc) =>
    acc.devices.map((d) => ({ accountId: acc.accountId, device: d }))
  )

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => logout()
      }
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 顶部账号信息 */}
      {accounts.length > 0 && (
        <View style={styles.accountBar}>
          <Text style={styles.accountText} numberOfLines={1}>
            {accounts[0].session.user.name || accounts[0].session.user.account}
          </Text>
          <View style={styles.accountActions}>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>退出</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={allDevices}
        keyExtractor={(item) => `${item.accountId}_${item.device.dev_id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>暂无设备</Text>
            <Text style={styles.emptyHint}>请先在拓竹官网绑定打印机</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DeviceCard
            accountId={item.accountId}
            device={item.device}
            onPress={() =>
              navigation.navigate('DeviceDetail', {
                accountId: item.accountId,
                deviceId: item.device.dev_id,
                deviceName: item.device.name
              })
            }
          />
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  accountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  accountText: {
    fontSize: 14,
    color: '#616161',
    flex: 1
  },
  accountActions: {
    flexDirection: 'row',
    gap: 12
  },
  logoutText: {
    fontSize: 14,
    color: '#f44336'
  },
  listContent: {
    padding: 16,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  cardHeader: {
    gap: 4
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
    marginRight: 8
  },
  cardModel: {
    fontSize: 13,
    color: '#9e9e9e'
  },
  cardBody: {
    marginTop: 12,
    gap: 8
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196f3',
    borderRadius: 3
  },
  progressText: {
    fontSize: 13,
    color: '#757575',
    minWidth: 36
  },
  tempRow: {
    flexDirection: 'row',
    gap: 16
  },
  tempText: {
    fontSize: 13,
    color: '#757575'
  },
  amsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap'
  },
  amsDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyText: {
    fontSize: 16,
    color: '#757575'
  },
  emptyHint: {
    fontSize: 13,
    color: '#9e9e9e',
    marginTop: 4
  }
})

export default DeviceListScreen
