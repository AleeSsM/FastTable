import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker/src/datetimepicker';

import { Comensal } from '@/constants/theme-comensal';

type Props = {
  value: Date;
  onChange: (next: Date) => void;
  minDate?: Date;
};

/** Selector de fecha y hora (iOS inline / Android trigger + diálogos). En web se usa date-time-field.web.tsx. */
export function DateTimeField({ value, onChange, minDate }: Props) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const onIosChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (d) onChange(d);
  };

  const onAndroidDate = (_e: DateTimePickerEvent, sel?: Date) => {
    setShowDate(false);
    if (!sel) return;
    const n = new Date(value);
    n.setFullYear(sel.getFullYear(), sel.getMonth(), sel.getDate());
    onChange(n);
    setShowTime(true);
  };

  const onAndroidTime = (_e: DateTimePickerEvent, sel?: Date) => {
    setShowTime(false);
    if (!sel) return;
    const n = new Date(value);
    n.setHours(sel.getHours(), sel.getMinutes(), 0, 0);
    onChange(n);
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosShell}>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="inline"
          onChange={onIosChange}
          locale="es_ES"
          themeVariant="dark"
          accentColor={Comensal.accent}
          minimumDate={minDate}
          style={styles.iosPicker}
        />
      </View>
    );
  }

  const formatted = value.toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          setShowTime(false);
          setShowDate(true);
        }}>
        <Text style={styles.triggerText}>{formatted}</Text>
        <Text style={styles.triggerHint}>Toca para cambiar</Text>
      </Pressable>
      {showDate ? (
        <DateTimePicker value={value} mode="date" display="default" onChange={onAndroidDate} minimumDate={minDate} />
      ) : null}
      {showTime ? (
        <DateTimePicker value={value} mode="time" display="default" onChange={onAndroidTime} is24Hour />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  iosShell: {
    overflow: 'hidden',
    alignItems: 'center',
    marginHorizontal: 0,
    marginBottom: 8,
    minHeight: 380,
    justifyContent: 'center',
  },
  iosPicker: { width: '100%', maxWidth: 340, height: 380 },
  trigger: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Comensal.radiusSm,
    borderWidth: 1,
    borderColor: Comensal.border,
    backgroundColor: Comensal.surfaceInput,
  },
  triggerText: { fontSize: 17, color: Comensal.text, fontWeight: '400' },
  triggerHint: { fontSize: 12, color: Comensal.textFaint, marginTop: 4 },
});
