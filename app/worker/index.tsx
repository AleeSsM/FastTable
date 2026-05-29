import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBoot } from '@/components/auth-boot';
import { Avatar } from '@/components/avatar';
import { FtColors } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import { useSafeSignOut } from '@/hooks/use-safe-sign-out';
import {
  fmtFecha,
  formatGuestName,
  solicitudCodigo,
  useWorkerDashboard,
  type MesaToggle,
  type WaitlistEntry,
} from '@/hooks/use-worker-dashboard';
import { textoSaludoStaff } from '@/lib/greeting';
import { roleLabel } from '@/lib/worker-nav';

type HostTab = 'fila' | 'reservas' | 'mesas' | 'equipo';
type WaiterTab = 'mesas' | 'solicitudes';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 }
    : { elevation: 6 };

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const { loading: authLoading, signingOut: authSigningOut } = useAuth();
  const { safeSignOut, signingOut: localSigningOut } = useSafeSignOut();
  const signingOut = authSigningOut || localSigningOut;
  const d = useWorkerDashboard();
  const { staffMember, session, isHost, isWaiter } = d;

  const [hostTab, setHostTab] = useState<HostTab>('fila');
  const [waiterTab, setWaiterTab] = useState<WaiterTab>('mesas');

  if (authLoading || signingOut) {
    return <AuthBoot variant="worker" />;
  }
  if (!session) return <Redirect href="/" />;
  if (!staffMember) return <Redirect href="/login" />;
  if (staffMember.rol === 'cocina') return <Redirect href="/worker/kitchen" />;
  if (Platform.OS === 'web' && staffMember.rol === 'gerente') return <Redirect href="/worker/gerente" />;

  const freeMesas = d.allMesas.filter((m) => m.estado === 'libre');

  const renderChoiceChips = (
    items: { key: string; label: string }[],
    selected: string | undefined,
    onSelect: (key: string) => void,
    emptyText: string,
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choiceRow}>
      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        items.map((it) => (
          <Pressable
            key={it.key}
            style={[styles.choiceChip, selected === it.key && styles.choiceChipActive]}
            onPress={() => onSelect(it.key)}>
            <Text style={[styles.choiceChipText, selected === it.key && styles.choiceChipTextActive]}>
              {it.label}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );

  const renderWaitlistCard = (entry: WaitlistEntry, index: number) => {
    const guestName = formatGuestName(
      entry.id_usuario ? d.waitlistNames[entry.id_usuario] : null,
      entry.id_usuario,
      entry.nombre_cliente,
    );
    return (
      <View key={entry.id} style={[styles.card, cardShadow]}>
        <View style={styles.rowHead}>
          <Avatar uri={entry.id_usuario ? d.waitlistFotos[entry.id_usuario] : null} name={guestName} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.turnTag}>Turno #{index + 1}</Text>
            <Text style={styles.cardName}>{guestName}</Text>
            <Text style={styles.cardMeta}>
              {entry.personas_grupo} personas · {fmtFecha(entry.unido_en)}
            </Text>
          </View>
        </View>
        {entry.nota ? <Text style={styles.note}>Nota: {entry.nota}</Text> : null}

        <Text style={styles.fieldLabel}>Mesa disponible</Text>
        {renderChoiceChips(
          freeMesas.map((m) => ({ key: m.id, label: m.codigo })),
          d.selectedMesaByEntry[entry.id],
          (key) => d.setSelectedMesaByEntry((p) => ({ ...p, [entry.id]: key })),
          'Sin mesas libres.',
        )}

        <Text style={styles.fieldLabel}>Mesero responsable</Text>
        {renderChoiceChips(
          d.meseroLoads.map((m) => ({ key: m.id, label: `${m.nombre_visible} (${m.mesasAtendidas})` })),
          d.selectedMeseroByEntry[entry.id],
          (key) => d.setSelectedMeseroByEntry((p) => ({ ...p, [entry.id]: key })),
          'Sin meseros en línea.',
        )}

        <Pressable
          style={[styles.btnPrimary, d.assigningEntryId === entry.id && styles.btnDisabled]}
          disabled={d.assigningEntryId === entry.id}
          onPress={() => d.onAssignWaitlist(entry)}>
          <Text style={styles.btnPrimaryText}>
            {d.assigningEntryId === entry.id ? 'Asignando…' : 'Asignar mesa y mesero'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderFila = () => (
    <View style={styles.section}>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.miniTitle}>Carga de meseros</Text>
        {d.meseroLoads.length === 0 ? (
          <Text style={styles.empty}>No hay meseros activos.</Text>
        ) : (
          d.meseroLoads.map((m) => (
            <View key={m.id} style={styles.loadRow}>
              <Text style={styles.loadName}>{m.nombre_visible}</Text>
              <Text style={styles.loadCount}>{m.mesasAtendidas} mesas</Text>
            </View>
          ))
        )}
      </View>
      {d.waitlist.length === 0 ? (
        <Text style={styles.empty}>No hay comensales en espera.</Text>
      ) : (
        d.waitlist.map((entry, i) => renderWaitlistCard(entry, i))
      )}
    </View>
  );

  const renderReservas = () => (
    <View style={styles.section}>
      {d.attendOrdered.length === 0 ? (
        <Text style={styles.empty}>Nada pendiente por atender ahora.</Text>
      ) : (
        d.attendOrdered.map((r) => {
          const code = r.mesas?.codigo ?? '—';
          const guest = d.names[r.id_usuario]?.trim() || 'Cliente';
          const other = r.mesas?.id_personal_atendiendo != null && r.mesas.id_personal_atendiendo !== staffMember.id;
          const showNoShow = d.canShowNoShow(r, new Date());
          const isLate = new Date(r.fecha_hora_reserva).getTime() < Date.now();
          return (
            <View key={r.id} style={[styles.card, cardShadow]}>
              <View style={styles.rowHead}>
                <Avatar uri={d.fotos[r.id_usuario]} name={guest} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Mesa {code} · {guest}</Text>
                  <Text style={styles.cardMeta}>
                    {fmtFecha(r.fecha_hora_reserva)} · {r.personas_grupo} pers.
                  </Text>
                </View>
                <View style={[styles.pill, isLate ? styles.pillWarn : styles.pillInfo]}>
                  <Text style={[styles.pillText, isLate ? styles.pillTextWarn : styles.pillTextInfo]}>
                    {isLate ? 'Prioridad' : 'Próxima'}
                  </Text>
                </View>
              </View>
              {r.nota ? <Text style={styles.note}>Nota: {r.nota}</Text> : null}
              {other ? (
                <Text style={styles.warn}>Otro mesero está atendiendo esta mesa.</Text>
              ) : (
                <>
                  {isHost ? (
                    <>
                      <Text style={styles.fieldLabel}>Mesero responsable</Text>
                      {renderChoiceChips(
                        d.meseroLoads.map((m) => ({ key: m.id, label: `${m.nombre_visible} (${m.mesasAtendidas})` })),
                        d.selectedMeseroByReserva[r.id],
                        (key) => d.setSelectedMeseroByReserva((p) => ({ ...p, [r.id]: key })),
                        'Sin meseros en línea.',
                      )}
                    </>
                  ) : null}
                  <Pressable style={styles.btnPrimary} onPress={() => d.onAtenderCompleta(r.id)} disabled={other}>
                    <Text style={styles.btnPrimaryText}>Atender (confirmar llegada)</Text>
                  </Pressable>
                  {showNoShow ? (
                    <Pressable style={styles.btnDanger} onPress={() => d.resolve(r.id, false)}>
                      <Text style={styles.btnDangerText}>Comensal no llegó</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.hintSmall}>
                      Tras 5 min de la hora acordada podrás marcar “Comensal no llegó”.
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })
      )}

      <Text style={styles.miniTitle}>Próximas reservas</Text>
      {d.upcoming.length === 0 ? (
        <Text style={styles.empty}>No hay reservas próximas.</Text>
      ) : (
        d.upcoming.map((r) => {
          const guest = d.names[r.id_usuario]?.trim() || 'Cliente';
          return (
            <View key={r.id} style={[styles.cardSoft, styles.rowHead]}>
              <Avatar uri={d.fotos[r.id_usuario]} name={guest} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.mesas?.codigo ?? '—'} · {guest}</Text>
                <Text style={styles.cardMeta}>
                  {fmtFecha(r.fecha_hora_reserva)} · {r.personas_grupo} pers.
                </Text>
              </View>
            </View>
          );
        })
      )}

      <Pressable style={styles.linkRow} onPress={() => router.push('/worker/reservations')}>
        <Text style={styles.linkText}>Vista detallada de reservas</Text>
        <Ionicons name="chevron-forward" size={18} color={FtColors.accentMuted} />
      </Pressable>
    </View>
  );

  const renderMesaToggleRow = (m: MesaToggle) => {
    const busy = d.mesaBusy === m.id;
    const other = m.id_personal_atendiendo != null && m.id_personal_atendiendo !== staffMember.id;
    return (
      <View key={m.id} style={styles.mesaTile}>
        <Text style={styles.mesaCode}>{m.codigo}</Text>
        {m.estado === 'reservada' ? (
          <Text style={styles.mesaState}>Reservada</Text>
        ) : m.estado === 'libre' ? (
          <Pressable
            style={[styles.mesaBtn, styles.mesaBtnFill]}
            disabled={busy}
            onPress={() => d.onToggleMesaWalkIn(m)}>
            {busy ? (
              <ActivityIndicator color={FtColors.onAccent} size="small" />
            ) : (
              <Text style={styles.mesaBtnFillText}>Ocupar</Text>
            )}
          </Pressable>
        ) : other ? (
          <Text style={styles.mesaState}>Otro mesero</Text>
        ) : (
          <Pressable style={styles.mesaBtn} disabled={busy} onPress={() => d.onToggleMesaWalkIn(m)}>
            {busy ? (
              <ActivityIndicator color={FtColors.accent} size="small" />
            ) : (
              <Text style={styles.mesaBtnText}>Liberar</Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  const renderMesas = () => (
    <View style={styles.section}>
      <Text style={styles.sub}>
        Ocupa o libera mesas sin reserva (walk-in). Las reservadas se gestionan en Reservas.
      </Text>
      <View style={styles.mesaGrid}>{d.allMesas.map((m) => renderMesaToggleRow(m))}</View>
    </View>
  );

  const renderMisMesas = () => (
    <View style={styles.section}>
      {d.myMesas.length === 0 ? (
        <Text style={styles.empty}>No tienes mesas asignadas ahora mismo.</Text>
      ) : (
        d.myMesas.map((m) => (
          <View key={m.id} style={[styles.card, cardShadow]}>
            <View style={styles.rowHead}>
              <Text style={styles.mesaCodeLg}>{m.codigo}</Text>
              <View style={[styles.pill, m.estado === 'reservada' ? styles.pillInfo : styles.pillOk]}>
                <Text style={[styles.pillText, m.estado === 'reservada' ? styles.pillTextInfo : styles.pillTextOk]}>
                  {m.estado === 'reservada' ? 'Reservada' : 'Ocupada'}
                </Text>
              </View>
            </View>
            {(() => {
              const cli = d.mesaClientes[m.id];
              const tieneCuenta = !!cli?.userId;
              const displayName = cli?.nombre?.trim() || (tieneCuenta ? 'Comensal' : 'Walk-in');
              return (
                <View style={styles.clienteRow}>
                  {tieneCuenta || cli?.foto ? (
                    <Avatar uri={cli?.foto} name={displayName} size={36} />
                  ) : (
                    <View style={styles.walkinAvatar}>
                      <Ionicons name="walk-outline" size={20} color={FtColors.textMuted} />
                    </View>
                  )}
                  <View style={styles.clienteMeta}>
                    <Text style={styles.clienteNombre} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text style={styles.clienteSub}>
                      {tieneCuenta ? 'Comensal en esta mesa' : 'Walk-in · sin cuenta'}
                    </Text>
                  </View>
                </View>
              );
            })()}
            {m.estado === 'ocupada' ? (
              <>
                <Pressable
                  style={styles.btnOutline}
                  onPress={() =>
                    router.push({ pathname: '/worker/mesa-pedidos', params: { mesaId: m.id, codigo: m.codigo } })
                  }>
                  <Text style={styles.btnOutlineText}>Pedir / ver cuenta</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPrimary, d.terminarBusyId === m.id && styles.btnDisabled]}
                  onPress={() => void d.confirmarTerminarServicio(m)}
                  disabled={d.terminarBusyId === m.id}>
                  {d.terminarBusyId === m.id ? (
                    <ActivityIndicator color={FtColors.onAccent} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Terminar servicio</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Text style={styles.hintSmall}>Esperando llegada del comensal.</Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderEquipo = () => (
    <View style={styles.section}>
      <Text style={styles.sub}>
        Reasigna las mesas de un mesero a otro si alguien no puede continuar (p. ej. se siente mal).
      </Text>
      {d.meseroLoads.length === 0 ? (
        <Text style={styles.empty}>No hay meseros activos.</Text>
      ) : (
        d.meseroLoads.map((m) => {
          const mesas = d.meseroMesas[m.id] ?? [];
          const otros = d.meseroLoads.filter((x) => x.id !== m.id);
          return (
            <View key={m.id} style={[styles.card, cardShadow]}>
              <Text style={styles.cardName}>{m.nombre_visible}</Text>
              <Text style={styles.cardMeta}>
                {mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'} a su cargo
              </Text>
              {mesas.length > 0 ? (
                <View style={styles.mesaChipsWrap}>
                  {mesas.map((mesa) => (
                    <View key={mesa.id} style={styles.mesaChipTag}>
                      <Text style={styles.mesaChipTagText}>{mesa.codigo}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.hintSmall}>Sin mesas asignadas.</Text>
              )}
              {mesas.length > 0 && otros.length > 0 ? (
                <>
                  <Text style={styles.fieldLabel}>Pasar todas a</Text>
                  {renderChoiceChips(
                    otros.map((o) => ({ key: o.id, label: `${o.nombre_visible} (${o.mesasAtendidas})` })),
                    undefined,
                    (key) => {
                      const dest = otros.find((o) => o.id === key);
                      if (dest) void d.reasignarMeseroTodo(m.id, m.nombre_visible, dest.id, dest.nombre_visible);
                    },
                    'Sin otros meseros.',
                  )}
                </>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );

  const renderSolicitudes = () => (
    <View style={styles.section}>
      {d.solicitudes.length === 0 ? (
        <Text style={styles.empty}>No hay solicitudes abiertas.</Text>
      ) : (
        d.solicitudes.map((s) => (
          <View key={s.id} style={[styles.card, cardShadow]}>
            <Text style={styles.cardName}>Mesa {solicitudCodigo(s.mesas)}</Text>
            <Text style={styles.cardMeta}>{s.mensaje?.trim() || '(Sin mensaje)'}</Text>
            <Pressable style={styles.btnPrimary} onPress={() => d.marcarSolicitudAtendida(s.id)}>
              <Text style={styles.btnPrimaryText}>Marcar como atendida</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );

  const hostTabs: { key: HostTab; label: string; icon: keyof typeof Ionicons.glyphMap; count: number }[] = [
    { key: 'fila', label: 'Fila', icon: 'people-outline', count: d.waiting ?? 0 },
    { key: 'reservas', label: 'Reservas', icon: 'calendar-outline', count: d.attendOrdered.length },
    { key: 'mesas', label: 'Mesas', icon: 'grid-outline', count: d.available ?? 0 },
    { key: 'equipo', label: 'Equipo', icon: 'swap-horizontal-outline', count: 0 },
  ];
  const waiterTabs: { key: WaiterTab; label: string; icon: keyof typeof Ionicons.glyphMap; count: number }[] = [
    { key: 'mesas', label: 'Mis mesas', icon: 'bookmark-outline', count: d.myMesas.length },
    { key: 'solicitudes', label: 'Solicitudes', icon: 'chatbubble-ellipses-outline', count: d.openReqCount ?? 0 },
  ];

  const summary = isHost
    ? [
        { label: 'Mesas libres', value: d.available, tone: FtColors.success },
        { label: 'En fila', value: d.waiting, tone: FtColors.warning },
        { label: 'A atender', value: d.attendOrdered.length, tone: FtColors.accent },
      ]
    : [
        { label: 'Mis mesas', value: d.myMesas.length, tone: FtColors.accent },
        { label: 'Solicitudes', value: d.openReqCount, tone: FtColors.warning },
        { label: 'Mesas libres', value: d.available, tone: FtColors.success },
      ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={d.refreshing}
            onRefresh={d.onRefresh}
            tintColor={FtColors.accent}
            colors={[FtColors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}>
        {staffMember.rol === 'gerente' ? (
          <Pressable style={styles.backRow} onPress={() => router.replace('/worker/gerente')}>
            <Ionicons name="chevron-back" size={18} color={FtColors.accent} />
            <Text style={styles.backText}>Volver a panel gerente</Text>
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{roleLabel(staffMember.rol)}</Text>
          <Text style={styles.heroTitle}>{staffMember.nombre_visible}</Text>
          <Text style={styles.heroGreeting}>{textoSaludoStaff(staffMember.nombre_visible)}</Text>
        </View>

        <View style={styles.summaryRow}>
          {summary.map((s) => (
            <View key={s.label} style={[styles.summaryCard, cardShadow]}>
              <Text style={[styles.summaryValue, { color: s.tone }]}>{s.value ?? '—'}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabBar}>
          {(isHost ? hostTabs : waiterTabs).map((t) => {
            const active = isHost ? hostTab === t.key : waiterTab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => (isHost ? setHostTab(t.key as HostTab) : setWaiterTab(t.key as WaiterTab))}>
                <Ionicons name={t.icon} size={18} color={active ? FtColors.onAccent : FtColors.textMuted} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {t.count > 0 ? (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{t.count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {d.loading && !d.refreshing ? (
          <ActivityIndicator color={FtColors.accent} style={{ marginVertical: 24 }} />
        ) : isWaiter ? (
          waiterTab === 'mesas' ? (
            renderMisMesas()
          ) : (
            renderSolicitudes()
          )
        ) : hostTab === 'fila' ? (
          renderFila()
        ) : hostTab === 'reservas' ? (
          renderReservas()
        ) : hostTab === 'mesas' ? (
          renderMesas()
        ) : (
          renderEquipo()
        )}

        <Pressable style={styles.linkRow} onPress={() => router.push('/perfil')}>
          <Text style={styles.linkText}>Mi perfil (nombre y foto)</Text>
          <Ionicons name="chevron-forward" size={18} color={FtColors.accentMuted} />
        </Pressable>

        <Pressable style={styles.signOut} onPress={safeSignOut} disabled={signingOut}>
          <Text style={styles.signOutText}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FtColors.background },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 48 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, marginTop: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: FtColors.accent, fontWeight: '700' },
  hero: { marginTop: 6, marginBottom: 18 },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: FtColors.accentMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: { fontSize: 27, fontWeight: '800', color: FtColors.text, marginTop: 4, letterSpacing: -0.4 },
  heroGreeting: { fontSize: 14, color: FtColors.textMuted, marginTop: 6, lineHeight: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  summaryValue: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  summaryLabel: { fontSize: 12, color: FtColors.textMuted, marginTop: 4, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderRadius: 14,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.border,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: FtColors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: FtColors.textMuted },
  tabTextActive: { color: FtColors.onAccent },
  tabBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 999,
    backgroundColor: FtColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: { backgroundColor: 'rgba(18,16,14,0.22)' },
  tabBadgeText: { fontSize: 11, fontWeight: '800', color: FtColors.textMuted },
  tabBadgeTextActive: { color: FtColors.onAccent },
  section: { marginBottom: 8 },
  sub: { fontSize: 13, color: FtColors.textMuted, lineHeight: 20, marginBottom: 14 },
  miniTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: FtColors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
    marginBottom: 12,
  },
  cardSoft: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    marginBottom: 10,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  turnTag: { fontSize: 11, color: FtColors.accentMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  cardName: { fontSize: 16, fontWeight: '800', color: FtColors.text, marginTop: 2 },
  cardMeta: { fontSize: 13, color: FtColors.textMuted, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, color: FtColors.textMuted, marginTop: 10, lineHeight: 19 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: FtColors.textFaint,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  choiceRow: { marginBottom: 2 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surface,
    marginRight: 8,
  },
  choiceChipActive: { borderColor: FtColors.accent, backgroundColor: 'rgba(124,140,255,0.18)' },
  choiceChipText: { fontSize: 13, fontWeight: '700', color: FtColors.textMuted },
  choiceChipTextActive: { color: FtColors.text },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  loadName: { fontSize: 14, color: FtColors.text, fontWeight: '600' },
  loadCount: { fontSize: 13, color: FtColors.textMuted, fontWeight: '700' },
  empty: { fontSize: 14, color: FtColors.textMuted, marginVertical: 8 },
  warn: { fontSize: 13, color: FtColors.warning, marginTop: 10 },
  hintSmall: { fontSize: 12, color: FtColors.textMuted, lineHeight: 17, marginTop: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillInfo: { backgroundColor: 'rgba(124,140,255,0.16)' },
  pillWarn: { backgroundColor: 'rgba(240,189,115,0.2)' },
  pillOk: { backgroundColor: 'rgba(99,200,164,0.18)' },
  pillText: { fontSize: 11, fontWeight: '800' },
  pillTextInfo: { color: FtColors.accent },
  pillTextWarn: { color: FtColors.warning },
  pillTextOk: { color: FtColors.success },
  btnPrimary: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: FtColors.accent,
    alignItems: 'center',
  },
  btnPrimaryText: { color: FtColors.onAccent, fontWeight: '800', fontSize: 15 },
  btnOutline: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FtColors.accent,
    alignItems: 'center',
  },
  btnOutlineText: { color: FtColors.accent, fontWeight: '800', fontSize: 15 },
  btnDanger: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FtColors.danger,
    alignItems: 'center',
  },
  btnDangerText: { color: FtColors.danger, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  mesaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mesaTile: {
    width: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
    alignItems: 'center',
    gap: 10,
  },
  mesaCode: { fontSize: 18, fontWeight: '800', color: FtColors.text },
  mesaCodeLg: { fontSize: 22, fontWeight: '800', color: FtColors.text, flex: 1 },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: FtColors.border,
  },
  clienteMeta: { flex: 1 },
  clienteNombre: { fontSize: 15, fontWeight: '700', color: FtColors.text },
  clienteSub: { fontSize: 12, color: FtColors.textMuted, marginTop: 1 },
  walkinAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  mesaState: { fontSize: 12, color: FtColors.textMuted, fontWeight: '600' },
  mesaBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FtColors.accent,
    alignItems: 'center',
    minWidth: 110,
  },
  mesaBtnText: { fontSize: 14, fontWeight: '700', color: FtColors.accent },
  mesaBtnFill: { backgroundColor: FtColors.accent, borderColor: FtColors.accent },
  mesaBtnFillText: { fontSize: 14, fontWeight: '800', color: FtColors.onAccent },
  mesaChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  mesaChipTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  mesaChipTagText: { fontSize: 14, fontWeight: '800', color: FtColors.text },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FtColors.border,
    marginTop: 8,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: FtColors.accent },
  signOut: { paddingVertical: 16, alignItems: 'center' },
  signOutText: { fontSize: 15, color: FtColors.textFaint, textDecorationLine: 'underline' },
});
