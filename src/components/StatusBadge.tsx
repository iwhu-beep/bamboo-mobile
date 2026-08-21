// ============================================================
// StatusBadge —— 打印机状态徽章组件
// ============================================================

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { GcodeState } from '../shared/types'
import { STATE_LABELS, STATE_COLORS } from '../shared/types'

interface StatusBadgeProps {
  state: GcodeState
  online: boolean
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ state, online }) => {
  if (!online) {
    return (
      <View style={[styles.badge, { backgroundColor: '#616161' }]}>
        <Text style={styles.text}>离线</Text>
      </View>
    )
  }

  const color = STATE_COLORS[state] ?? '#9e9e9e'
  const label = STATE_LABELS[state] ?? state

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  }
})

export default StatusBadge
