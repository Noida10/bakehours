import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useTabSave } from './SaveContext';
import {
  workingDays,
  defaultVacationRange,
  monthsBetween,
  shortDate,
} from '../lib/weeks';
import { VAC_CYCLE, VAC_STYLE, VAC_LABEL } from '../lib/constants';
import Skeleton from './Skeleton';

export default function VacationTab({ user }) {
  const range = useMemo(() => defaultVacationRange(), []);
  const days = useMemo(() => workingDays(range.start, range.end), [range]);
  const months = useMemo(() => monthsBetween(range.start, range.end), [range]);

  const [entries, setEntries] = useState({}); // { iso: code }
  const [saved, setSaved] = useState('{}');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(months.map((m) => api.getVacation(m)))
      .then((results) => {
        if (!active) return;
        const merged = {};
        results.forEach((data) => {
          const mine = data.members[user.name] || {};
          Object.assign(merged, mine);
        });
        setEntries(merged);
        setSaved(JSON.stringify(merged));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [months.join(','), user.name]);

  const dirty = !loading && JSON.stringify(entries) !== saved;

  const saver = useCallback(async () => {
    // Write each month's full set of days (null clears a previously-set day).
    const byMonth = {};
    for (const day of days) {
      if (!byMonth[day.monthKey]) byMonth[day.monthKey] = {};
      byMonth[day.monthKey][day.iso] = entries[day.iso] || null;
    }
    for (const [monthKey, payload] of Object.entries(byMonth)) {
      await api.putVacation(monthKey, user.name, payload);
    }
    setSaved(JSON.stringify(entries));
  }, [days, entries, user.name]);

  useTabSave(saver, dirty);

  function cycle(day) {
    setEntries((cur) => {
      const nextCode = VAC_CYCLE[cur[day.iso] || ''];
      const next = { ...cur };
      if (nextCode === '') delete next[day.iso];
      else next[day.iso] = nextCode;
      return next;
    });
  }

  const summary = useMemo(() => {
    const v = [];
    const h = [];
    const w = [];
    for (const day of days) {
      const code = entries[day.iso];
      if (code === 'V') v.push(day.iso);
      else if (code === 'H') h.push(day.iso);
      else if (code === 'WFH') w.push(day.iso);
    }
    return { v, h, w };
  }, [days, entries]);

  if (loading) return <Skeleton rows={3} />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-800">My Vacation Plan</h2>
          {dirty && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved — use Save in the header
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Tap a day to cycle: empty → V → H → WFH → empty
        </p>

        <div className="overflow-x-auto">
          <div className="inline-flex pb-1">
            {days.map((day, i) => {
              const code = entries[day.iso] || '';
              const weekGap = day.dayName === 'Mon' && i > 0 ? 'ml-3' : 'ml-1.5';
              return (
                <button
                  type="button"
                  key={day.iso}
                  onClick={() => cycle(day)}
                  className={`${weekGap} h-14 w-14 shrink-0 rounded-lg border border-slate-200 text-xs font-semibold flex flex-col items-center justify-center transition ${
                    code
                      ? VAC_STYLE[code]
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-normal opacity-70">
                    {day.dayName}
                  </span>
                  <span className="text-[10px] font-normal opacity-70">
                    {day.label}
                  </span>
                  <span className="text-sm">{code || '·'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <Legend code="V" /> <Legend code="H" /> <Legend code="WFH" />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-semibold text-slate-800 mb-2">Upcoming</h3>
        <p className="text-sm text-slate-600">
          {summary.v.length} vacation {summary.v.length === 1 ? 'day' : 'days'},{' '}
          {summary.h.length} half {summary.h.length === 1 ? 'day' : 'days'},{' '}
          {summary.w.length} WFH {summary.w.length === 1 ? 'day' : 'days'}
        </p>
        <div className="mt-2 space-y-1 text-sm">
          {summary.v.length > 0 && (
            <p>
              <span className="font-semibold text-red-600">V:</span>{' '}
              {summary.v.map(shortDate).join(', ')}
            </p>
          )}
          {summary.h.length > 0 && (
            <p>
              <span className="font-semibold text-yellow-600">H:</span>{' '}
              {summary.h.map(shortDate).join(', ')}
            </p>
          )}
          {summary.w.length > 0 && (
            <p>
              <span className="font-semibold text-emerald-600">WFH:</span>{' '}
              {summary.w.map(shortDate).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ code }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${VAC_STYLE[code]}`} />
      {code} = {VAC_LABEL[code]}
    </span>
  );
}
