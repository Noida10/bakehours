import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { useNow, formatRelative } from '../lib/useRelativeTime';
import { SPRINT_FIELDS, rowTotal, rowTotalDev } from '../lib/constants';
import WeekSelector from './WeekSelector';
import Skeleton from './Skeleton';

const BASE_MEMBERS = [
  'Anmol', 'Vinay', 'Roshan', 'Chandrakesh', 'Pawan',
  'Harit', 'Sushobhita', 'Divya',
];

export default function TeamSprintTab({ user, weekId, setWeekId }) {
  const toast = useToast();
  useNow();
  const editable = user.canEdit; // Anmol true, Julien false

  const [sprint, setSprint] = useState(null);
  const [projects, setProjects] = useState(null);
  const [members, setMembers] = useState(BASE_MEMBERS);
  const [loading, setLoading] = useState(true);
  const timers = useRef({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getSprint(weekId),
      api.getProjects(weekId),
      api.getRoster().catch(() => ({ devMembers: BASE_MEMBERS })),
    ])
      .then(([s, p, r]) => {
        setSprint(s);
        setProjects(p);
        setMembers(r.devMembers || BASE_MEMBERS);
        setLoading(false);
      })
      .catch(() => {
        toast.show('Failed to load team data', { type: 'error' });
        setLoading(false);
      });
  }, [weekId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function updateAnmol(key, raw) {
    let v = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(5, v));
    const next = { ...sprint };
    next.members = { ...next.members, Anmol: { ...next.members.Anmol, [key]: v } };
    setSprint(next);
    clearTimeout(timers.current.anmol);
    timers.current.anmol = setTimeout(() => {
      const fields = {};
      for (const f of SPRINT_FIELDS) fields[f.key] = Number(next.members.Anmol[f.key]) || 0;
      api
        .putSprint(weekId, 'Anmol', fields)
        .then((saved) => {
          setSprint((cur) => ({
            ...cur,
            members: { ...cur.members, Anmol: saved },
          }));
          toast.show('Saved');
        })
        .catch(() => toast.show('Save failed', { type: 'error' }));
    }, 500);
  }

  if (loading || !sprint || !projects) {
    return (
      <div className="space-y-4">
        <Skeleton rows={2} />
        <Skeleton rows={6} />
      </div>
    );
  }

  const totals = {};
  for (const f of SPRINT_FIELDS) totals[f.key] = 0;
  members.forEach((name) => {
    const m = sprint.members[name] || {};
    for (const f of SPRINT_FIELDS) totals[f.key] += Number(m[f.key]) || 0;
  });
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandDev = totals.project + totals.bug + totals.training;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector value={weekId} onChange={setWeekId} />
        <button
          type="button"
          onClick={load}
          className="text-xs text-brand-600 hover:underline"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-800 text-white">
              <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-brand-800">
                Who
              </th>
              {SPRINT_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2.5 font-semibold text-center">
                  {f.label}
                </th>
              ))}
              <th className="px-2 py-2.5 font-semibold text-center">Total</th>
              <th className="px-2 py-2.5 font-semibold text-center">Total Dev</th>
              <th className="px-3 py-2.5 font-semibold text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {members.map((name, idx) => {
              const m = sprint.members[name] || {};
              const isAnmol = name === 'Anmol';
              const submitted = !!m.lastUpdated;
              return (
                <tr
                  key={name}
                  className={idx % 2 ? 'bg-slate-50' : 'bg-white'}
                >
                  <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-inherit">
                    {name}
                    {isAnmol && (
                      <span className="ml-1 text-[10px] text-brand-600">(you)</span>
                    )}
                  </td>
                  {SPRINT_FIELDS.map((f) => {
                    const val = Number(m[f.key]) || 0;
                    if (isAnmol && editable) {
                      return (
                        <td key={f.key} className="px-1 py-1">
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            value={m[f.key] ?? 0}
                            onChange={(e) => updateAnmol(f.key, e.target.value)}
                            className="w-14 rounded border border-slate-300 px-1 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={f.key}
                        className={`px-2 py-2 text-center ${
                          !submitted
                            ? 'border border-dashed border-yellow-400 text-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {submitted ? val : '–'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold text-brand-800">
                    {rowTotal(m)}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-700">
                    {rowTotalDev(m)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {formatRelative(m.lastUpdated)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-brand-100 font-bold text-brand-900 border-t-2 border-brand-200">
              <td className="px-3 py-2 sticky left-0 bg-brand-100">Total</td>
              {SPRINT_FIELDS.map((f) => (
                <td key={f.key} className="px-2 py-2 text-center">
                  {totals[f.key]}
                </td>
              ))}
              <td className="px-2 py-2 text-center">{grandTotal}</td>
              <td className="px-2 py-2 text-center">{grandDev}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <TeamProjectBreakdown
        weekId={weekId}
        projects={projects}
        editable={editable}
        onReload={load}
      />
    </div>
  );
}

function TeamProjectBreakdown({ weekId, projects, editable, onReload }) {
  const toast = useToast();
  const [summary, setSummary] = useState(projects.compiledSummary || []);
  const timer = useRef(null);

  useEffect(() => {
    setSummary(projects.compiledSummary || []);
  }, [projects]);

  function save(next) {
    setSummary(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api
        .putCompiled(weekId, next)
        .then(() => toast.show('Saved'))
        .catch(() => toast.show('Save failed', { type: 'error' }));
    }, 600);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Team Project Breakdown</h2>
        {editable && (
          <button
            type="button"
            onClick={() => onReload()}
            className="text-xs text-brand-600 hover:underline"
            title="Recompile from member submissions"
          >
            ↻ Recompile from members
          </button>
        )}
      </div>
      {summary.length === 0 && (
        <p className="text-sm text-slate-400 italic">
          No project entries yet. They auto-compile from member submissions.
        </p>
      )}
      <div className="space-y-2">
        {summary.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={item.name}
              readOnly={!editable}
              onChange={(e) => {
                const next = summary.slice();
                next[i] = { ...next[i], name: e.target.value };
                save(next);
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 read-only:bg-slate-50"
            />
            <input
              type="number"
              min={0}
              step={0.5}
              value={item.days}
              readOnly={!editable}
              onChange={(e) => {
                const next = summary.slice();
                next[i] = { ...next[i], days: Number(e.target.value) || 0 };
                save(next);
              }}
              className="w-20 rounded-md border border-slate-300 px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-brand-500 read-only:bg-slate-50"
            />
            <span className="hidden sm:block w-40 truncate text-xs text-slate-400">
              {(item.contributors || []).join(', ')}
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => save(summary.filter((_, j) => j !== i))}
                className="h-9 w-9 shrink-0 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {editable && (
        <button
          type="button"
          onClick={() =>
            save([...summary, { name: '', days: 0, contributors: [] }])
          }
          className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          + Add entry
        </button>
      )}
    </div>
  );
}
