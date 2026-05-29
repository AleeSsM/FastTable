import { Comensal } from '@/constants/theme-comensal';

type Props = {
  value: Date;
  onChange: (next: Date) => void;
  minDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Selector de fecha y hora para web: input nativo del navegador (datetime-local). */
export function DateTimeField({ value, onChange, minDate }: Props) {
  return (
    <input
      type="datetime-local"
      value={toLocalInputValue(value)}
      min={minDate ? toLocalInputValue(minDate) : undefined}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        const next = new Date(v);
        if (!Number.isNaN(next.getTime())) onChange(next);
      }}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px',
        borderRadius: Comensal.radiusSm as number,
        border: `1px solid ${Comensal.border}`,
        backgroundColor: Comensal.surfaceInput,
        color: Comensal.text,
        fontSize: '16px',
        colorScheme: 'dark',
        marginBottom: '8px',
      }}
    />
  );
}
