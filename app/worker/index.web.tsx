import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { StatCard, WebCard, WebCardHead, WebHeader, WebRow, WebScroll, webStyles } from '@/components/web/ui';
import { FtColors } from '@/constants/fasttable';
import { useAuth } from '@/contexts/auth-context';
import {
  fmtFecha,
  formatGuestName,
  solicitudCodigo,
  useWorkerDashboard,
  type MesaToggle,
  type WaitlistEntry,
} from '@/hooks/use-worker-dashboard';
import {
  parseNavSection,
  roleLabel,
  type AnfitrionSection,
  type MeseroSection,
} from '@/lib/worker-nav';

const MESERO_TITLE: Record<MeseroSection, string> = {
  resumen: 'Un vistazo a tu turno: mesas, solicitudes y disponibilidad.',
  mesas: 'Tus mesas asignadas y el comensal que atiende cada una.',
  solicitudes: 'Llamadas de atención de tus comensales.',
  libres: 'Ocupa una mesa para un walk-in o libérala al terminar.',
};

const ANFITRION_TITLE: Record<AnfitrionSection, string> = {
  resumen: 'Recepción: fila, reservas y mesas en un vistazo.',
  fila: 'Comensales en espera y asignación de mesa y mesero.',
  reservas: 'Reservas por atender y próximas llegadas.',
  mesas: 'Mapa de mesas: ocupar walk-ins o liberar.',
  equipo: 'Carga de meseros y reasignación de mesas.',
};

export default function WorkerDashboardWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sec?: string }>();
  const { loading: authLoading } = useAuth();
  const d = useWorkerDashboard();
  const { staffMember, session, isHost, isWaiter } = d;

  if (authLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FtColors.accent} size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (!staffMember) return <Redirect href="/login" />;
  if (staffMember.rol === 'cocina') return <Redirect href="/worker/kitchen" />;
  if (staffMember.rol === 'gerente') return <Redirect href="/worker/gerente" />;

  const freeMesas = d.allMesas.filter((m) => m.estado === 'libre');

  const chips = (
    items: { key: string; label: string }[],
    selected: string | undefined,
    onSelect: (k: string) => void,
    empty: string,
  ) => (
    <View style={styles.chipWrap}>
      {items.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        items.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => onSelect(it.key)}
            style={[styles.chip, selected === it.key && styles.chipOn]}>
            <Text style={[styles.chipText, selected === it.key && styles.chipTextOn]}>{it.label}</Text>
          </Pressable>
        ))
      )}
    </View>
  );

  const waitlistCard = (entry: WaitlistEntry, index: number) => {
    const guestName = formatGuestName(
      entry.id_usuario ? d.waitlistNames[entry.id_usuario] : null,
      entry.id_usuario,
      entry.nombre_cliente,
    );
    return (
      <View key={entry.id} style={styles.subCard}>
        <View style={styles.rowHead}>
          <Avatar uri={entry.id_usuario ? d.waitlistFotos[entry.id_usuario] : null} name={guestName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.turnTag}>Turno #{index + 1}</Text>
            <Text style={styles.itemName}>{guestName}</Text>
            <Text style={styles.itemMeta}>
              {entry.personas_grupo} personas · {fmtFecha(entry.unido_en)}
            </Text>
          </View>
        </View>
        {entry.nota ? <Text style={styles.note}>Nota: {entry.nota}</Text> : null}
        <Text style={styles.fieldLabel}>Mesa disponible</Text>
        {chips(
          freeMesas.map((m) => ({ key: m.id, label: m.codigo })),
          d.selectedMesaByEntry[entry.id],
          (k) => d.setSelectedMesaByEntry((p) => ({ ...p, [entry.id]: k })),
          'Sin mesas libres.',
        )}
        <Text style={styles.fieldLabel}>Mesero responsable</Text>
        {chips(
          d.meseroLoads.map((m) => ({ key: m.id, label: `${m.nombre_visible} (${m.mesasAtendidas})` })),
          d.selectedMeseroByEntry[entry.id],
          (k) => d.setSelectedMeseroByEntry((p) => ({ ...p, [entry.id]: k })),
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

  const mesaTile = (m: MesaToggle) => {
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
            {busy ? <ActivityIndicator color={FtColors.onAccent} size="small" /> : <Text style={styles.mesaBtnFillText}>Ocupar</Text>}
          </Pressable>
        ) : other ? (
          <Text style={styles.mesaState}>Otro mesero</Text>
        ) : (
          <Pressable style={styles.mesaBtn} disabled={busy} onPress={() => d.onToggleMesaWalkIn(m)}>
            {busy ? <ActivityIndicator color={FtColors.accent} size="small" /> : <Text style={styles.mesaBtnText}>Liberar</Text>}
          </Pressable>
        )}
      </View>
    );
  };

  const hostSummary = [
    { icon: 'grid-outline' as const, label: 'Mesas libres', value: d.available ?? 0, tone: FtColors.success },
    { icon: 'people-outline' as const, label: 'En fila', value: d.waiting ?? 0, tone: FtColors.warning },
    { icon: 'calendar-outline' as const, label: 'Reservas a atender', value: d.attendOrdered.length, tone: FtColors.accent },
    { icon: 'time-outline' as const, label: 'Próximas reservas', value: d.upcoming.length, tone: FtColors.text },
  ];
  const waiterSummary = [
    { icon: 'bookmark-outline' as const, label: 'Mis mesas', value: d.myMesas.length, tone: FtColors.accent },
    { icon: 'chatbubble-ellipses-outline' as const, label: 'Solicitudes', value: d.openReqCount ?? 0, tone: FtColors.warning },
    { icon: 'grid-outline' as const, label: 'Mesas libres', value: d.available ?? 0, tone: FtColors.success },
  ];

  const sec = parseNavSection(staffMember.rol, params.sec, '/worker');

  const loader = d.loading && !d.refreshing ? (
    <ActivityIndicator color={FtColors.accent} style={{ marginVertical: 16 }} />
  ) : null;

  const mesaMiaCard = (m: (typeof d.myMesas)[number]) => {
    const cli = d.mesaClientes[m.id];
    const tieneCuenta = !!cli?.userId;
    const displayName = cli?.nombre?.trim() || (tieneCuenta ? 'Comensal' : 'Walk-in');
    return (
      <View key={m.id} style={styles.subCard}>
        <View style={styles.rowHead}>
          {tieneCuenta || cli?.foto ? (
            <Avatar uri={cli?.foto} name={displayName} size={48} />
          ) : (
            <View style={styles.walkinAvatar}>
              <Ionicons name="walk-outline" size={24} color={FtColors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.itemMeta}>{tieneCuenta ? `Mesa ${m.codigo}` : `Mesa ${m.codigo} · sin cuenta`}</Text>
          </View>
          <View style={[styles.pill, m.estado === 'reservada' ? styles.pillInfo : styles.pillOk]}>
            <Text style={[styles.pillText, m.estado === 'reservada' ? styles.pillTextInfo : styles.pillTextOk]}>
              {m.estado === 'reservada' ? 'Reservada' : 'Ocupada'}
            </Text>
          </View>
        </View>
        {m.estado === 'ocupada' ? (
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btnOutline, { flex: 1 }]}
              onPress={() =>
                router.push({ pathname: '/worker/mesa-pedidos', params: { mesaId: m.id, codigo: m.codigo } } as Href)
              }>
              <Text style={styles.btnOutlineText}>Pedir / ver cuenta</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { flex: 1, marginTop: 0 }, d.terminarBusyId === m.id && styles.btnDisabled]}
              onPress={() => void d.confirmarTerminarServicio(m)}
              disabled={d.terminarBusyId === m.id}>
              {d.terminarBusyId === m.id ? (
                <ActivityIndicator color={FtColors.onAccent} />
              ) : (
                <Text style={styles.btnPrimaryText}>Terminar servicio</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hintSmall}>Esperando llegada del comensal.</Text>
        )}
      </View>
    );
  };

  const misMesasCard = (
    <WebCard>
      <WebCardHead icon="bookmark-outline" title="Mis mesas" />
      {d.myMesas.length === 0 ? (
        <Text style={styles.empty}>No tienes mesas asignadas ahora mismo.</Text>
      ) : (
        d.myMesas.map((m) => mesaMiaCard(m))
      )}
    </WebCard>
  );

  const solicitudesCard = (
    <WebCard>
      <WebCardHead icon="chatbubble-ellipses-outline" color={FtColors.warning} title="Solicitudes de servicio" />
      {d.solicitudes.length === 0 ? (
        <Text style={styles.empty}>No hay solicitudes abiertas.</Text>
      ) : (
        d.solicitudes.map((s) => (
          <View key={s.id} style={styles.subCard}>
            <Text style={styles.itemName}>Mesa {solicitudCodigo(s.mesas)}</Text>
            <Text style={styles.itemMeta}>{s.mensaje?.trim() || '(Sin mensaje)'}</Text>
            <Pressable style={styles.btnPrimary} onPress={() => d.marcarSolicitudAtendida(s.id)}>
              <Text style={styles.btnPrimaryText}>Marcar como atendida</Text>
            </Pressable>
          </View>
        ))
      )}
    </WebCard>
  );

  const mesasLibresCard = (
    <WebCard>
      <WebCardHead icon="apps-outline" color={FtColors.success} title="Mesas libres" />
      <Text style={styles.cardHint}>Ocupa una mesa para un walk-in o libérala cuando termine el servicio.</Text>
      {d.allMesas.length === 0 ? (
        <Text style={styles.empty}>No hay mesas registradas.</Text>
      ) : (
        <View style={styles.mesaGrid}>{d.allMesas.map((m) => mesaTile(m))}</View>
      )}
    </WebCard>
  );

  const hostFilaCard = (
    <WebCard>
      <WebCardHead icon="people-outline" color={FtColors.success} title="Fila de espera" />
      <View style={styles.loadCard}>
        <Text style={styles.loadTitle}>Carga de meseros</Text>
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
        d.waitlist.map((entry, i) => waitlistCard(entry, i))
      )}
    </WebCard>
  );

  const hostReservasCard = (
    <>
      <WebCard>
        <WebCardHead icon="calendar-outline" title="Reservas a atender" />
        {d.attendOrdered.length === 0 ? (
          <Text style={styles.empty}>Nada pendiente por atender ahora.</Text>
        ) : (
          d.attendOrdered.map((r) => {
            const code = r.mesas?.codigo ?? '—';
            const guest = d.names[r.id_usuario]?.trim() || 'Cliente';
            const other =
              r.mesas?.id_personal_atendiendo != null && r.mesas.id_personal_atendiendo !== staffMember.id;
            const showNoShow = d.canShowNoShow(r, new Date());
            const isLate = new Date(r.fecha_hora_reserva).getTime() < Date.now();
            return (
              <View key={r.id} style={styles.subCard}>
                <View style={styles.rowHead}>
                  <Avatar uri={d.fotos[r.id_usuario]} name={guest} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>Mesa {code} · {guest}</Text>
                    <Text style={styles.itemMeta}>{fmtFecha(r.fecha_hora_reserva)} · {r.personas_grupo} pers.</Text>
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
                    <Text style={styles.fieldLabel}>Mesero responsable</Text>
                    {chips(
                      d.meseroLoads.map((m) => ({ key: m.id, label: `${m.nombre_visible} (${m.mesasAtendidas})` })),
                      d.selectedMeseroByReserva[r.id],
                      (k) => d.setSelectedMeseroByReserva((p) => ({ ...p, [r.id]: k })),
                      'Sin meseros en línea.',
                    )}
                    <View style={styles.btnRow}>
                      <Pressable style={[styles.btnPrimary, { flex: 1 }]} onPress={() => d.onAtenderCompleta(r.id)}>
                        <Text style={styles.btnPrimaryText}>Atender</Text>
                      </Pressable>
                      {showNoShow ? (
                        <Pressable style={[styles.btnDanger, { flex: 1 }]} onPress={() => d.resolve(r.id, false)}>
                          <Text style={styles.btnDangerText}>No llegó</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {!showNoShow ? (
                      <Text style={styles.hintSmall}>Tras 5 min de la hora podrás marcar “no llegó”.</Text>
                    ) : null}
                  </>
                )}
              </View>
            );
          })
        )}
      </WebCard>
      <View style={{ height: 16 }} />
      <WebCard>
        <WebCardHead icon="time-outline" color={FtColors.textMuted} title="Próximas reservas" />
        {d.upcoming.length === 0 ? (
          <Text style={styles.empty}>No hay reservas próximas.</Text>
        ) : (
          d.upcoming.map((r) => {
            const guest = d.names[r.id_usuario]?.trim() || 'Cliente';
            return (
              <View key={r.id} style={[styles.rowHead, styles.upcomingRow]}>
                <Avatar uri={d.fotos[r.id_usuario]} name={guest} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{r.mesas?.codigo ?? '—'} · {guest}</Text>
                  <Text style={styles.itemMeta}>{fmtFecha(r.fecha_hora_reserva)} · {r.personas_grupo} pers.</Text>
                </View>
              </View>
            );
          })
        )}
        <Pressable style={styles.linkRow} onPress={() => router.push('/worker/reservations' as Href)}>
          <Text style={styles.linkText}>Vista detallada de reservas</Text>
          <Ionicons name="chevron-forward" size={18} color={FtColors.accentMuted} />
        </Pressable>
      </WebCard>
    </>
  );

  const hostMesasCard = (
    <WebCard>
      <WebCardHead icon="grid-outline" title="Mapa de mesas" />
      <Text style={styles.cardHint}>Ocupar/liberar walk-ins. Las reservadas se gestionan en Reservas.</Text>
      <View style={styles.mesaGrid}>{d.allMesas.map((m) => mesaTile(m))}</View>
    </WebCard>
  );

  const hostEquipoCard = (
    <WebCard>
      <WebCardHead icon="swap-horizontal-outline" title="Equipo · flujo de meseros" />
      <Text style={styles.cardHint}>
        Reasigna las mesas de un mesero a otro si alguien no puede continuar (p. ej. se siente mal).
      </Text>
      {d.meseroLoads.length === 0 ? (
        <Text style={styles.empty}>No hay meseros activos.</Text>
      ) : (
        <View style={styles.equipoGrid}>
          {d.meseroLoads.map((m) => {
            const mesas = d.meseroMesas[m.id] ?? [];
            const otros = d.meseroLoads.filter((x) => x.id !== m.id);
            return (
              <View key={m.id} style={styles.equipoCard}>
                <Text style={styles.itemName}>{m.nombre_visible}</Text>
                <Text style={styles.itemMeta}>
                  {mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'} a su cargo
                </Text>
                {mesas.length > 0 ? (
                  <View style={styles.meseroTagsWrap}>
                    {mesas.map((mesa) => (
                      <View key={mesa.id} style={styles.meseroTag}>
                        <Text style={styles.meseroTagText}>{mesa.codigo}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hintSmall}>Sin mesas asignadas.</Text>
                )}
                {mesas.length > 0 && otros.length > 0 ? (
                  <>
                    <Text style={styles.fieldLabel}>Pasar todas a</Text>
                    {chips(
                      otros.map((o) => ({ key: o.id, label: `${o.nombre_visible} (${o.mesasAtendidas})` })),
                      undefined,
                      (k) => {
                        const dest = otros.find((o) => o.id === k);
                        if (dest) void d.reasignarMeseroTodo(m.id, m.nombre_visible, dest.id, dest.nombre_visible);
                      },
                      'Sin otros meseros.',
                    )}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </WebCard>
  );

  return (
    <WebScroll
      maxWidth={1480}
      refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.onRefresh} tintColor={FtColors.accent} />}>
      <WebHeader
        eyebrow={roleLabel(staffMember.rol)}
        title={`Hola, ${staffMember.nombre_visible}`}
        subtitle={
          isHost
            ? ANFITRION_TITLE[sec as AnfitrionSection] ?? ANFITRION_TITLE.resumen
            : MESERO_TITLE[sec as MeseroSection] ?? MESERO_TITLE.resumen
        }
      />

      {isWaiter ? (
        <>
          {sec === 'resumen' ? (
            <>
              <WebRow>
                {waiterSummary.map((s) => (
                  <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} />
                ))}
              </WebRow>
              <View style={{ height: 18 }} />
              {loader}
              <WebRow>
                <View style={[webStyles.col, { flex: 1.5, minWidth: 380 }]}>{misMesasCard}</View>
                <View style={[webStyles.col, { flex: 1, minWidth: 320 }]}>{solicitudesCard}</View>
              </WebRow>
            </>
          ) : sec === 'mesas' ? (
            <>
              {loader}
              {misMesasCard}
            </>
          ) : sec === 'solicitudes' ? (
            <>
              {loader}
              {solicitudesCard}
            </>
          ) : (
            <>
              {loader}
              {mesasLibresCard}
            </>
          )}
        </>
      ) : (
        <>
          {sec === 'resumen' ? (
            <>
              <WebRow>
                {hostSummary.map((s) => (
                  <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} />
                ))}
              </WebRow>
              <View style={{ height: 18 }} />
              {loader}
              <WebRow>
                <View style={[webStyles.col, { flex: 1, minWidth: 360 }]}>{hostFilaCard}</View>
                <View style={[webStyles.col, { flex: 1, minWidth: 360 }]}>{hostReservasCard}</View>
              </WebRow>
            </>
          ) : sec === 'fila' ? (
            <>
              {loader}
              {hostFilaCard}
            </>
          ) : sec === 'reservas' ? (
            <>
              {loader}
              {hostReservasCard}
            </>
          ) : sec === 'mesas' ? (
            <>
              {loader}
              {hostMesasCard}
            </>
          ) : (
            <>
              {loader}
              {hostEquipoCard}
            </>
          )}
        </>
      )}

      <View style={{ height: 28 }} />
    </WebScroll>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: FtColors.background },
  empty: { fontSize: 14, color: FtColors.textMuted, marginVertical: 6 },
  cardHint: { fontSize: 12, color: FtColors.textMuted, marginTop: -8, marginBottom: 12, lineHeight: 18 },
  subCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    marginBottom: 12,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcomingRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FtColors.borderSubtle,
  },
  turnTag: { fontSize: 11, color: FtColors.accentMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  itemName: { fontSize: 15, fontWeight: '800', color: FtColors.text, marginTop: 2 },
  itemMeta: { fontSize: 13, color: FtColors.textMuted, marginTop: 3, lineHeight: 18 },
  note: { fontSize: 13, color: FtColors.textMuted, marginTop: 10, lineHeight: 19 },
  warn: { fontSize: 13, color: FtColors.warning, marginTop: 10 },
  hintSmall: { fontSize: 12, color: FtColors.textMuted, lineHeight: 17, marginTop: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: FtColors.textFaint,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FtColors.border,
    backgroundColor: FtColors.surfaceElevated,
  },
  chipOn: { borderColor: FtColors.accent, backgroundColor: 'rgba(124,140,255,0.18)' },
  chipText: { fontSize: 13, fontWeight: '700', color: FtColors.textMuted },
  chipTextOn: { color: FtColors.text },
  loadCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    marginBottom: 14,
  },
  loadTitle: { fontSize: 13, fontWeight: '800', color: FtColors.text, marginBottom: 8 },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  loadName: { fontSize: 14, color: FtColors.text, fontWeight: '600' },
  loadCount: { fontSize: 13, color: FtColors.textMuted, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillInfo: { backgroundColor: 'rgba(124,140,255,0.16)' },
  pillWarn: { backgroundColor: 'rgba(240,189,115,0.2)' },
  pillOk: { backgroundColor: 'rgba(99,200,164,0.18)' },
  pillText: { fontSize: 11, fontWeight: '800' },
  pillTextInfo: { color: FtColors.accent },
  pillTextWarn: { color: FtColors.warning },
  pillTextOk: { color: FtColors.success },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnPrimary: { marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: FtColors.accent, alignItems: 'center' },
  btnPrimaryText: { color: FtColors.onAccent, fontWeight: '800', fontSize: 14 },
  btnOutline: { paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: FtColors.accent, alignItems: 'center' },
  btnOutlineText: { color: FtColors.accent, fontWeight: '800', fontSize: 14 },
  btnDanger: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: FtColors.danger, alignItems: 'center' },
  btnDangerText: { color: FtColors.danger, fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  mesaCodeLg: { fontSize: 20, fontWeight: '800', color: FtColors.text, flex: 1 },
  walkinAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: FtColors.border,
  },
  clienteMeta: { flex: 1 },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: FtColors.text },
  clienteSub: { fontSize: 12, color: FtColors.textMuted, marginTop: 1 },
  mesaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mesaTile: {
    flexGrow: 1,
    flexBasis: 92,
    minWidth: 88,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
    alignItems: 'center',
    gap: 10,
  },
  mesaCode: { fontSize: 16, fontWeight: '800', color: FtColors.text },
  mesaState: { fontSize: 11, color: FtColors.textMuted, fontWeight: '600', textAlign: 'center' },
  mesaBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: FtColors.accent,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  mesaBtnText: { fontSize: 13, fontWeight: '700', color: FtColors.accent },
  mesaBtnFill: { backgroundColor: FtColors.accent, borderColor: FtColors.accent },
  mesaBtnFillText: { fontSize: 13, fontWeight: '800', color: FtColors.onAccent },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FtColors.border,
  },
  linkText: { fontSize: 14, fontWeight: '700', color: FtColors.accent },
  equipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  equipoCard: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 280,
    padding: 16,
    borderRadius: 14,
    backgroundColor: FtColors.surface,
    borderWidth: 1,
    borderColor: FtColors.borderSubtle,
  },
  meseroTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  meseroTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: FtColors.surfaceElevated,
    borderWidth: 1,
    borderColor: FtColors.border,
  },
  meseroTagText: { fontSize: 14, fontWeight: '800', color: FtColors.text },
});

