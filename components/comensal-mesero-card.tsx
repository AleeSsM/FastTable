import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Comensal } from '@/constants/theme-comensal';
import { fetchMeseroDeMesa, type MeseroAsignado } from '@/lib/mesa-activa';

/**
 * Tarjeta que muestra al comensal quién lo está atendiendo (nombre + foto).
 * Si la mesa aún no tiene mesero asignado, muestra un aviso suave.
 */
export function ComensalMeseroCard({ idMesa, reloadKey }: { idMesa: string; reloadKey?: number }) {
  const [mesero, setMesero] = useState<MeseroAsignado | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetchMeseroDeMesa(idMesa)
      .then((m) => {
        if (active) setMesero(m);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [idMesa, reloadKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Te atiende</Text>
      {mesero ? (
        <View style={styles.row}>
          <Avatar uri={mesero.foto_url} name={mesero.nombre_visible} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{mesero.nombre_visible}</Text>
            <Text style={styles.role}>Tu mesero</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>
          {loaded ? 'Aún no se ha asignado un mesero a tu mesa.' : 'Cargando…'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: Comensal.radiusMd,
    backgroundColor: Comensal.surfaceElevated,
    borderWidth: 1,
    borderColor: Comensal.border,
    marginBottom: 14,
  },
  label: { fontSize: 13, fontWeight: '700', color: Comensal.text, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 17, fontWeight: '800', color: Comensal.text },
  role: { fontSize: 13, color: Comensal.accentMuted, marginTop: 2, fontWeight: '600' },
  hint: { fontSize: 14, color: Comensal.textMuted, lineHeight: 20 },
});
