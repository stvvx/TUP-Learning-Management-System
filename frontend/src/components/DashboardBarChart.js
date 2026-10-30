import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function DashboardBarChart({ title, data, color = '#7B1113' }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chart}>
        {data.map((item) => (
          <View key={item.label} style={styles.column}>
            <Text style={styles.value}>{item.value}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${Math.max((item.value / maxValue) * 100, item.value ? 8 : 2)}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF9EE', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EBC9A0', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#4A0A0C', marginBottom: 16 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8 },
  column: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: 12, fontWeight: '700', color: '#7B1113', marginBottom: 5 },
  barTrack: { width: '70%', height: 105, justifyContent: 'flex-end', backgroundColor: '#F6E4E4', borderRadius: 8, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  label: { fontSize: 10, color: '#6E6165', textAlign: 'center', marginTop: 7 }
});
