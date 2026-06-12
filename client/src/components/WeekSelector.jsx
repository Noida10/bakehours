import { useMemo } from 'react';
import { weekOptions } from '../lib/weeks';

export default function WeekSelector({ value, onChange }) {
  const options = useMemo(() => weekOptions(12, 2), []);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
    >
      {options.map((w) => (
        <option key={w.id} value={w.id}>
          {w.label}
        </option>
      ))}
    </select>
  );
}
