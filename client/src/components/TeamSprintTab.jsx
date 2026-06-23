import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { useTabSave } from './SaveContext';
import { SPRINT_FIELDS, rowTotal, rowTotalDev } from '../lib/constants';
import WeekSelector from './WeekSelector';
import ProjectSelect from './ProjectSelect';
import Skeleton from './Skeleton';

const BASE_MEMBERS = [
  'Anmol', 'Vinay', 'Roshan', 'Chandrakesh', 'Pavan',
  'Harit', 'Sushobhita', 'Divya',
];

const EMPTY_ROW = {
  project: 0, bug: 0, training: 0, other: 0, meeting: 0, lead: 0, off: 0,
};

function shortStamp(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function TeamSprintTab({ user, weekId, setWeekId }) {
  const toast = useToast();
  const editable = user.canEdit; // Anmol true, Julien false

  const [sprint, setSprint] = useState(null);
  const [summary, setSummary] = useState([]); // editable compiled breakdown
  const [members, setMembers] = useState(BASE_MEMBERS);
  const [catalog, setCatalog] = useState([]); // project names from Manage tab
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);

  const snapshot = (sp, sum) =>
    JSON.stringify({ anmol: (sp && sp.members.Anmol) || {}, summary: sum });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getSprint(weekId),
      api.getProjects(weekId),
      api.getRoster().catch(() => ({ devMembers: BASE_MEMBERS })),
      api.getCatalog().catch(() => ({ projects: [] })),
    ])
      .then(([s, p, r, cat]) => {
        // Anmol edits the curated compiled summary. Julien (view-only) sees the
        // canonical breakdown — the curated summary if it has entries, else the
        // live combination of every member's submissions.
        const compiled = p.compiledSummary || [];
        const sum = editable
          ? compiled
          : compiled.length
          ? compiled
          : p.combined || [];
        setSprint(s);
        setSummary(sum);
        setMembers(r.devMembers || BASE_MEMBERS);
        setCatalog((cat.projects || []).map((x) => x.name));
        setSaved(snapshot(s, sum));
        setLoading(false);
      })
      .catch(() => {
        toast.show('Failed to load team data', { type: 'error' });
        setLoading(false);
      });
  }, [weekId, toast, editable]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = !loading && editable && snapshot(sprint, summary) !== saved;

  const saver = useCallback(async () => {
    const fields = {};
    const anmol = (sprint && sprint.members.Anmol) || EMPTY_ROW;
    for (const f of SPRINT_FIELDS) fields[f.key] = Number(anmol[f.key]) || 0;
    const savedRow = await api.putSprint(weekId, 'Anmol', fields);
    await api.putCompiled(weekId, summary);
    setSprint((cur) => ({
      ...cur,
      members: { ...cur.members, Anmol: savedRow },
    }));
    // Recompute the snapshot from the freshly-saved row.
    setSaved(
      JSON.stringify({ anmol: savedRow, summary })
    );
  }, [weekId, sprint, summary]);

  useTabSave(saver, dirty);

  function guard(action) {
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Continue without saving?')
    ) {
      return;
    }
    action();
  }

  function updateAnmol(key, raw) {
    let v = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(5, v));
    setSprint((cur) => ({
      ...cur,
      members: {
        ...cur.members,
        Anmol: { ...(cur.members.Anmol || EMPTY_ROW), [key]: v },
      },
    }));
  }

  if (loading || !sprint) {
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
        <WeekSelector value={weekId} onChange={(w) => guard(() => setWeekId(w))} />
        <button
          type="button"
          onClick={() => guard(load)}
          className="text-xs text-brand-600 hover:underline"
        >
          ↻ Reload from server
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
                <tr key={name} className={idx % 2 ? 'bg-slate-50' : 'bg-white'}>
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
                    {shortStamp(m.lastUpdated) || '—'}
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
        summary={summary}
        setSummary={setSummary}
        editable={editable}
        catalog={catalog}
      />
    </div>
  );
}

function TeamProjectBreakdown({ summary, setSummary, editable, catalog }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Team Project Breakdown</h2>
        {!editable && (
          <span className="text-xs text-slate-400">
            Combined from all member submissions
          </span>
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
            <ProjectSelect
              className="flex-1"
              value={item.name}
              options={catalog}
              readOnly={!editable}
              onChange={(v) => {
                const next = summary.slice();
                next[i] = { ...next[i], name: v };
                setSummary(next);
              }}
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
                setSummary(next);
              }}
              className="w-20 rounded-md border border-slate-300 px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-brand-500 read-only:bg-slate-50"
            />
            <span className="hidden sm:block w-40 truncate text-xs text-slate-400">
              {(item.contributors || []).join(', ')}
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => setSummary(summary.filter((_, j) => j !== i))}
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
            setSummary([...summary, { name: '', days: 0, contributors: [] }])
          }
          className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          + Add entry
        </button>
      )}
    </div>
  );
}
