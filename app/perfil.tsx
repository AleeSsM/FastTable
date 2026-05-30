import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { AuthBoot } from '@/components/auth-boot';
import { BRAND, RADII } from '@/constants/palette';
import { useAuth } from '@/contexts/auth-context';
import { useNavigateToWelcomeOnceWhen } from '@/hooks/use-auth-navigation';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { notify } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

function roleLabel(rol: string): string {
  switch (rol) {
    case 'anfitrion':
      return 'Anfitrión';
    case 'mesero':
      return 'Mesero';
    case 'gerente':
      return 'Gerente';
    case 'cocina':
      return 'Cocina';
    default:
      return rol;
  }
}

export default function PerfilScreen() {
  const router = useRouter();
  const { user, session, profile, staffMember, loading, signingOut, refreshProfile, refreshStaff } =
    useAuth();
  const isStaff = !!staffMember;

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsHome = !loading && !signingOut && (!session || !user);
  useNavigateToWelcomeOnceWhen(needsHome);

  useEffect(() => {
    if (staffMember) {
      setNombre(staffMember.nombre_visible ?? '');
      setFotoUrl(staffMember.foto_url ?? null);
    } else if (profile) {
      // El nombre debe venir precargado. Si el registro no trae nombre, usamos
      // el de los metadatos de la cuenta o, en último caso, el del correo.
      const metaName =
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined);
      const emailName = user?.email ? user.email.split('@')[0] : '';
      setNombre(profile.nombre_completo?.trim() || metaName?.trim() || emailName);
      setTelefono(profile.telefono ?? '');
      setFotoUrl(profile.foto_url ?? null);
    }
  }, [profile, staffMember, user]);

  if (loading || signingOut || needsHome || !session || !user) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={BRAND.accent} size="large" />
      </View>
    );
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(isStaff ? '/worker' : '/');
  };

  const onChangePhoto = async () => {
    if (!user?.id || uploading) return;
    setUploading(true);
    try {
      const url = await pickAndUploadAvatar(user.id);
      if (!url) return; // El usuario canceló la selección.
      if (isStaff) {
        const { error } = await supabase.from('personal').update({ foto_url: url }).eq('id_usuario', user.id);
        if (error) throw error;
        await refreshStaff();
      } else {
        const { error } = await supabase.from('perfiles').update({ foto_url: url }).eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      }
      setFotoUrl(url);
      notify('Foto de perfil', 'Tu foto se actualizó.');
      goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify(
        'Foto de perfil',
        msg === 'PERMISO_DENEGADO'
          ? 'Necesitamos permiso para acceder a tus fotos.'
          : `No se pudo actualizar la foto. ${msg}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!user?.id || saving) return;
    const visible = nombre.trim();
    if (!visible) {
      notify('Perfil', 'Tu nombre no puede quedar vacío.');
      return;
    }
    setSaving(true);
    try {
      if (isStaff) {
        const { error } = await supabase.from('personal').update({ nombre_visible: visible }).eq('id_usuario', user.id);
        if (error) throw error;
        await refreshStaff();
      } else {
        const { error } = await supabase
          .from('perfiles')
          .update({ nombre_completo: visible, telefono: telefono.trim() || null })
          .eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      }
      notify('Perfil', 'Tus cambios se guardaron.');
      goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify('Perfil', `No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <Pressable style={styles.backRow} onPress={goBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={BRAND.accent} />
              <Text style={styles.backText}>Volver</Text>
            </Pressable>

            <Text style={styles.eyebrow}>{isStaff ? roleLabel(staffMember.rol) : 'Mi cuenta'}</Text>
            <Text style={styles.title}>Perfil</Text>

            <View style={styles.avatarBlock}>
              <View>
                <Avatar uri={fotoUrl} name={nombre} size={104} />
                {uploading ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color={BRAND.onAccent} />
                  </View>
                ) : null}
              </View>
              <Pressable style={styles.photoBtn} onPress={onChangePhoto} disabled={uploading}>
                <Ionicons name="camera-outline" size={18} color={BRAND.accent} />
                <Text style={styles.photoBtnText}>{fotoUrl ? 'Cambiar foto' : 'Subir foto'}</Text>
              </Pressable>
              <Text style={styles.photoHint}>
                {isStaff
                  ? 'Tu equipo y el gerente verán esta foto.'
                  : 'El personal del restaurante verá esta foto al atenderte.'}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isStaff ? 'Nombre visible' : 'Nombre completo'}</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Tu nombre"
                placeholderTextColor={BRAND.textFaint}
                style={styles.input}
                maxLength={80}
              />
            </View>

            {!isStaff ? (
              <View style={styles.field}>
                <Text style={styles.label}>Teléfono (opcional)</Text>
                <TextInput
                  value={telefono}
                  onChangeText={setTelefono}
                  placeholder="Ej. 555 123 4567"
                  placeholderTextColor={BRAND.textFaint}
                  keyboardType="phone-pad"
                  style={styles.input}
                  maxLength={30}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Correo</Text>
              <View style={[styles.input, styles.inputReadonly]}>
                <Text style={styles.readonlyText}>{user.email ?? '—'}</Text>
              </View>
            </View>

            <Pressable style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={onSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={BRAND.onAccent} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar cambios</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.background },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.background },
  scroll: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 44 },
  inner: { width: '100%', maxWidth: 560 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backText: { fontSize: 15, color: BRAND.accent, fontWeight: '600' },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: BRAND.accentMuted,
    fontWeight: '700',
  },
  title: { fontSize: 28, fontWeight: '800', color: BRAND.text, marginTop: 6, marginBottom: 22 },
  avatarBlock: { alignItems: 'center', marginBottom: 26 },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,7,14,0.55)',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surfaceElevated,
  },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: BRAND.accent },
  photoHint: { fontSize: 12, color: BRAND.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: BRAND.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: BRAND.text,
    backgroundColor: BRAND.surfaceInput,
  },
  inputReadonly: { justifyContent: 'center', opacity: 0.8 },
  readonlyText: { fontSize: 15, color: BRAND.textMuted },
  saveBtn: {
    marginTop: 10,
    backgroundColor: BRAND.accent,
    paddingVertical: 15,
    borderRadius: RADII.pill,
    alignItems: 'center',
  },
  saveBtnText: { color: BRAND.onAccent, fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.7 },
});
