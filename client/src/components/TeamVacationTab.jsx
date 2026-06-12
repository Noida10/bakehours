import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import {
  workingDays,
  defaultVacationRange,
  monthsBetween,
} from '../lib/weeks';
import { VAC_CYCLE, VAC_STYLE, VAC_LABEL } from '../lib/constants';
import Skeleton from './Skeleton';

const DEV_MEMBERS = [
  'Anmol', 'Vinay', 'Roshan', 'Chandrakesh', 'Pawan',
  'Harit', 'Sushobhita', 'Divya',
];

export default function TeamVacationTab({ user }) {
  const toast = useToast();
  const editable = user.canEdit;
  const def = useMemo(() => defaultVacationRange(), []);
  const [range, setRange] = useState(def);
  const days = useMemo(() => workingDays(range.start, range.end), [range]);
  const months = useMemo(() => monthsBetween(range.start, range.end), [range]);

  // data: { member: { iso: code } }
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timers = useRef({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(months.map((m) => api.getVacation(m)))
      .then((results) => {
        if (!active) return;
        const merged = {};
        DEV_MEMBERS.forEach((name) => (merged[name] = {}));
        results.forEach((monthData) => {
          for (const [name, entries] of Object.entries(monthData.members || {})) {
            merged[name] = { ...(merged[name] || {}), ...entries };
          }
        });
        setData(merged);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          toast.show('Failed to load vacation data', { type: 'error' });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [months.join(','), range.start, range.end]);

  const saveCell = useCallback(
    (day, code) => {
      api
        .putVacation(day.monthKey, 'Anmol', { [day.iso]: code === '' ? null : code })
        .then(() => toast.show('Saved'))
        .catch(() => toast.show('Save failed', { type: 'error' }));
    },
    [toast]
  );

  function cycleAnmol(day) {
    if (!editable) return;
    const current = (data.Anmol || {})[day.iso] || '';
    const next = VAC_CYCLE[current];
    setData((cur) => {
      const anmol = { ...(cur.Anmol || {}) };
      if (next === '') delete anmol[day.iso];
      else anmol[day.iso] = next;
      return { ...cur, Anmol: anmol };
    });
    clearTimeout(timers.current[day.iso]);
    timers.current[day.iso] = setTimeout(() => saveCell(day, next), 250);
  }

  // Per-day availability (people with V are unavailable).
  const availability = useMemo(() => {
    if (!data) return [];
    return days.map((day) => {
      let off = 0;
      DEV_MEMBERS.forEach((name) => {
        if ((data[name] || {})[day.iso] === 'V') off++;
      });
      return { ...day, off, available: DEV_MEMBERS.length - off };
    });
  }, [days, data]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton rows={2} />
        <Skeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <DateField
          label="From"
          value={range.start}
          onChange={(v) => setRange((r) => ({ ...r, start: v }))}
        />
        <DateField
          label="To"
          value={range.end}
          onChange={(v) => setRange((r) => ({ ...r, end: v }))}
        />
        <button
          onClick={() => setRange(def)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Reset to next 4 weeks
        </button>
      </div>

      {/* Availability summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard title="Days with 2+ off" tone="warn">
          {availability.filter((d) => d.off >= 2).length === 0 ? (
            <span className="text-slate-400">None — good coverage</span>
          ) : (
            availability
              .filter((d) => d.off >= 2)
              .map((d) => `${d.dayName} ${d.label} (${d.off} off)`)
              .join(', ')
          )}
        </SummaryCard>
        <SummaryCard title="Lowest availability" tone="info">
          {(() => {
            const min = availability.reduce(
              (acc, d) => (d.available < acc.available ? d : acc),
              availability[0] || { available: DEV_MEMBERS.length }
            );
            return min && min.dayName
              ? `${min.dayName} ${min.label}: ${min.available}/${DEV_MEMBERS.length} available`
              : '—';
          })()}
        </SummaryCard>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-brand-800 text-white text-left px-3 py-2 font-semibold min-w-[110px]">
                Member
              </th>
              {days.map((day) => (
                <th
                  key={day.iso}
                  className="bg-brand-800 text-white px-1.5 py-1 font-semibold text-center min-w-[44px]"
                >
                  <div>{day.label.split('-')[0]}</div>
                  <div className="font-normal opacity-80">{day.dayName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEV_MEMBERS.map((name, idx) => {
              const isAnmol = name === 'Anmol';
              return (
                <tr key={name} className={idx % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="sticky left-0 z-10 px-3 py-1.5 font-medium text-slate-800 bg-inherit">
                    {name}
                    {isAnmol && editable && (
                      <span className="ml-1 text-[10px] text-brand-600">(you)</span>
                    )}
                  </td>
                  {days.map((day) => {
                    const code = (data[name] || {})[day.iso] || '';
                    const clickable = isAnmol && editable;
                    return (
                      <td key={day.iso} className="p-0.5 text-center">
                        <div
                          onClick={() => clickable && cycleAnmol(day)}
                          className={`h-8 rounded flex items-center justify-center font-semibold ${
                            VAC_STYLE[code] || 'bg-slate-50'
                          } ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-brand-400' : ''}`}
                        >
                          {code}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Availability row */}
            <tr className="border-t-2 border-brand-200 bg-brand-50 font-semibold text-brand-900">
              <td className="sticky left-0 z-10 px-3 py-1.5 bg-brand-50">
                Available
              </td>
              {availability.map((d) => (
                <td
                  key={d.iso}
                  className={`px-1 py-1.5 text-center ${
                    d.off >= 2 ? 'bg-orange-200 text-orange-900' : ''
                  }`}
                >
                  {d.available}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {['V', 'H', 'WFH'].map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${VAC_STYLE[c]}`} />
            {c} = {VAC_LABEL[c]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-orange-200" />
          2+ off (coverage warning)
        </span>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
      />
    </label>
  );
}

function SummaryCard({ title, tone, children }) {
  const toneClass =
    tone === 'warn'
      ? 'border-orange-200 bg-orange-50'
      : 'border-brand-200 bg-brand-50';
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {title}
      </h3>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
