import { StyleSheet, Text, type TextProps } from 'react-native';

import { Comensal } from '@/constants/theme-comensal';
import { useAuth } from '@/contexts/auth-context';
import { textoSaludoComensal } from '@/lib/greeting';

type Props = Omit<TextProps, 'children'>;

export function ComensalGreetingLine({ style, ...rest }: Props) {
  const { user, profile } = useAuth();
  if (!user) return null;
  const meta = user.user_metadata as { nombre_completo?: string; full_name?: string } | undefined;
  const metaNombre = meta?.nombre_completo ?? meta?.full_name ?? null;
  const line = textoSaludoComensal(profile?.nombre_completo, metaNombre);
  return (
    <Text style={[styles.line, style]} {...rest}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 15,
    lineHeight: 22,
    color: Comensal.textMuted,
    marginBottom: 10,
    fontWeight: '500',
  },
});
