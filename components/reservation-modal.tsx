import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { DateTimeField } from '@/components/date-time-field';
import { Comensal } from '@/constants/theme-comensal';
import { tableImageUrl } from '@/lib/table-image';

type Props = {
  visible: boolean;
  tableCode: string;
  /** Imagen de cabecera (URL). Si falta, se usa un placeholder. */
  tableHeroImageUrl?: string | null;
  /** Texto descriptivo de la mesa para el comensal. */
  tableDescription?: string | null;
  zoneName?: string | null;
  capacity?: number;
  /** YYYY-MM-DD del calendario de salón; sugiere hora al abrir el modal. */
  suggestedDayYmd?: string | null;
  onClose: () => void;
  onConfirm: (scheduledAt: Date, partySize: number, note: string) => Promise<void>;
};

const minFutureDate = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
};

export function ReservationModal({
  visible,
  tableCode,
  tableHeroImageUrl,
  tableDescription,
  zoneName,
  capacity,
  suggestedDayYmd,
  onClose,
  onConfirm,
}: Props) {
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setSeconds(0, 0);
    return d;
  });
  const [partySize, setPartySize] = useState('2');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (suggestedDayYmd) {
      const [y, mo, da] = suggestedDayYmd.split('-').map(Number);
      const min = minFutureDate();
      const slot = new Date(y, mo - 1, da, 13, 0, 0, 0);
      const chosen = slot.getTime() > min.getTime() ? slot : new Date(min.getTime() + 15 * 60 * 1000);
      setWhen(chosen);
    } else {
      const d = new Date();
      d.setMinutes(d.getMinutes() + 60);
      d.setSeconds(0, 0);
      setWhen(d);
    }
    const cap = capacity != null && capacity > 0 ? capacity : null;
    const defaultParty = cap != null ? Math.min(2, cap) : 2;
    setPartySize(String(defaultParty));
    setNote('');
  }, [visible, suggestedDayYmd, capacity]);

  const submit = async () => {
    const n = parseInt(partySize, 10);
    if (Number.isNaN(n) || n < 1) return;
    const cap = capacity != null && capacity > 0 ? capacity : null;
    if (cap != null && n > cap) {
      Alert.alert(
        'Capacidad de la mesa',
        `Esta mesa admite como máximo ${cap} ${cap === 1 ? 'persona' : 'personas'}.`,
      );
      return;
    }
    if (when.getTime() <= Date.now()) {
      Alert.alert('Fecha y hora', 'Elige un momento futuro.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(when, n, note.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      {...(Platform.OS === 'android' ? { hardwareAccelerated: false } : {})}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <Image
              source={{ uri: tableImageUrl(tableCode, tableHeroImageUrl) }}
              style={styles.heroImg}
              contentFit="cover"
              transition={200}
            />
            <Text style={styles.kicker}>Mesa {tableCode}</Text>
            <Text style={styles.title}>Reserva</Text>
            {zoneName != null || capacity != null ? (
              <Text style={styles.metaLine}>
                {[zoneName, capacity != null ? `${capacity} plazas` : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.desc}>
              {tableDescription?.trim() ||
                'Descripción de la mesa: podrás personalizarla desde el panel del restaurante.'}
            </Text>

            <Text style={styles.sectionLabel}>Datos de la reserva</Text>
            <Text style={styles.lead}>Elige fecha, hora y tamaño del grupo.</Text>

            <Text style={styles.label}>Fecha y hora</Text>
            <DateTimeField value={when} onChange={setWhen} minDate={minFutureDate()} />

            <Text style={styles.label}>Personas</Text>
            {capacity != null && capacity > 0 ? (
              <Text style={styles.hintBelowLabel}>Máximo {capacity} según la capacidad de la mesa.</Text>
            ) : null}
            <TextInput
              value={partySize}
              onChangeText={setPartySize}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="2"
              placeholderTextColor={Comensal.textFaint}
            />

            <Text style={styles.label}>Nota</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Opcional"
              placeholderTextColor={Comensal.textFaint}
              style={[styles.input, styles.inputMulti]}
              multiline
              scrollEnabled={false}
            />

            <View style={styles.actions}>
              <Pressable style={styles.secondary} onPress={onClose} disabled={busy}>
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, busy && styles.primaryDisabled]}
                onPress={submit}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={Comensal.onAccent} />
                ) : (
                  <Text style={styles.primaryText}>Confirmar</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Comensal.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Comensal.surfaceElevated,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: Platform.OS === 'ios' ? '88%' : '92%',
    borderWidth: 1,
    borderColor: Comensal.borderSubtle,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Comensal.border,
    marginTop: 10,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
  },
  heroImg: {
    width: '100%',
    height: 190,
    borderRadius: Comensal.radiusMd,
    marginBottom: 16,
    backgroundColor: Comensal.heroImgFallback,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Comensal.accentMuted,
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Comensal.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metaLine: { fontSize: 13, color: Comensal.textFaint, marginBottom: 10 },
  desc: {
    fontSize: 14,
    color: Comensal.textMuted,
    lineHeight: 22,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Comensal.accentMuted,
    marginBottom: 6,
  },
  lead: {
    fontSize: 14,
    color: Comensal.textMuted,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.3,
    color: Comensal.textFaint,
    marginBottom: 8,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  hintBelowLabel: {
    fontSize: 13,
    color: Comensal.textMuted,
    marginTop: -4,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Comensal.border,
    borderRadius: Comensal.radiusSm,
    backgroundColor: Comensal.surfaceInput,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Comensal.text,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  secondary: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Comensal.border,
  },
  secondaryText: { fontSize: 15, color: Comensal.textMuted, fontWeight: '500' },
  primary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: Comensal.accent,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.65 },
  primaryText: { fontSize: 15, fontWeight: '600', color: Comensal.onAccent, letterSpacing: 0.3 },
});
