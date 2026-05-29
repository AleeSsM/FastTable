import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { useAuth } from '@/contexts/auth-context';
import { Comensal } from '@/constants/theme-comensal';
import { supabase } from '@/lib/supabase';

export default function MoreScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDetail, setIssueDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onReportIssue = async () => {
    if (!user?.id) return;
    const title = issueTitle.trim();
    const detail = issueDetail.trim();
    if (!title || !detail) {
      Alert.alert('Reporte', 'Escribe un título y una descripción del problema.');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc('comensal_crear_reporte', {
        p_titulo: title,
        p_descripcion: detail,
      });
      if (error) {
        Alert.alert('Reporte', error.message);
        return;
      }
      setIssueTitle('');
      setIssueDetail('');
      Alert.alert(
        'Reporte enviado',
        'El gerente lo verá en su bandeja junto con quién te atendió y tus datos de contacto.',
      );
    } finally {
      setSending(false);
    }
  };

  const onSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    Keyboard.dismiss();

    const run = async () => {
      try {
        // iOS: no desmontar el árbol de tabs en el mismo tick del toque (ScrollView + TextInput + Redirect).
        if (Platform.OS === 'ios') {
          await new Promise<void>((resolve) => {
            InteractionManager.runAfterInteractions(() => {
              requestAnimationFrame(() => resolve());
            });
          });
        }
        await signOut();
      } catch {
        setSigningOut(false);
      }
    };

    if (Platform.OS === 'ios') {
      setTimeout(() => void run(), 0);
    } else {
      void run();
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <Text style={styles.eyebrow}>Cuenta y soporte</Text>
      <Text style={styles.title}>Más opciones</Text>

      <Pressable style={styles.linkCard} onPress={() => router.push('/perfil')}>
        <View style={styles.linkIcon}>
          <Avatar uri={profile?.foto_url} name={profile?.nombre_completo} size={42} />
        </View>
        <View style={styles.linkTextWrap}>
          <Text style={styles.sectionTitle}>Mi perfil</Text>
          <Text style={styles.sectionHint}>Edita tu nombre, teléfono y foto.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Comensal.textMuted} />
      </Pressable>

      <Pressable style={styles.linkCard} onPress={() => router.push('/mis-cuentas')}>
        <View style={styles.linkIcon}>
          <Ionicons name="receipt-outline" size={22} color={Comensal.accent} />
        </View>
        <View style={styles.linkTextWrap}>
          <Text style={styles.sectionTitle}>Mis cuentas</Text>
          <Text style={styles.sectionHint}>Revisa tus visitas y recibos anteriores.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Comensal.textMuted} />
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>¿Hubo un problema?</Text>
        <Text style={styles.sectionHint}>Cuéntanos y nuestro equipo lo revisará.</Text>
        <TextInput
          value={issueTitle}
          onChangeText={setIssueTitle}
          placeholder="Título breve"
          placeholderTextColor={Comensal.textMuted}
          style={styles.input}
          maxLength={90}
        />
        <TextInput
          value={issueDetail}
          onChangeText={setIssueDetail}
          placeholder="Describe lo ocurrido..."
          placeholderTextColor={Comensal.textMuted}
          multiline
          scrollEnabled={false}
          style={[styles.input, styles.textarea]}
          maxLength={700}
        />
        <Pressable style={[styles.primaryBtn, sending && styles.btnDisabled]} onPress={onReportIssue} disabled={sending}>
          <Text style={styles.primaryBtnText}>{sending ? 'Enviando…' : 'Enviar reporte'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sesión</Text>
        <Pressable
          style={[styles.ghostBtn, signingOut && styles.btnDisabled]}
          onPress={onSignOut}
          disabled={signingOut}>
          <Text style={styles.ghostBtnText}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Comensal.background },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Comensal.accentMuted,
    marginBottom: 8,
  },
  title: { fontSize: 24, color: Comensal.text, fontWeight: '800', marginBottom: 12 },
  card: {
    padding: 16,
    borderRadius: Comensal.radiusMd,
    backgroundColor: Comensal.surfaceElevated,
    borderWidth: 1,
    borderColor: Comensal.border,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Comensal.text },
  sectionHint: { fontSize: 13, color: Comensal.textMuted, marginTop: 4, marginBottom: 10 },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: Comensal.radiusMd,
    backgroundColor: Comensal.surfaceElevated,
    borderWidth: 1,
    borderColor: Comensal.border,
    marginBottom: 14,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Comensal.surfaceInput,
  },
  linkTextWrap: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: Comensal.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: Comensal.text,
    backgroundColor: Comensal.surfaceInput,
    marginBottom: 10,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: Comensal.accent,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryBtnText: { color: Comensal.onAccent, fontSize: 15, fontWeight: '800' },
  ghostBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { color: Comensal.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  btnDisabled: { opacity: 0.7 },
});
