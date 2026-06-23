import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useTabSave } from './SaveContext';
import {
  SPRINT_FIELDS,
  EXPECTED_TOTAL,
  rowTotal,
  rowTotalDev,
} from '../lib/constants';
import WeekSelector from './WeekSelector';
import ProjectSelect from './ProjectSelect';
import Skeleton from './Skeleton';

function NumberInput({ value, onChange }) {
  return (
    <input
      type="number"
      min={0}
      max={5}
      step={0.5}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}

const serialize = (row, projects) => JSON.stringify({ row, projects });

export default function SprintTab({ user, weekId, setWeekId }) {
  const [row, setRow] = useState(null);
  const [projects, setProjects] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [saved, setSaved] = useState(''); // snapshot of last-persisted state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.getSprint(weekId),
      api.getProjects(weekId),
      api.getCatalog().catch(() => ({ projects: [] })),
    ])
      .then(([sprint, proj, cat]) => {
        if (!active) return;
        const raw = sprint.members[user.name] || {
          project: 0, bug: 0, training: 0, other: 0, meeting: 0, lead: 0, off: 0,
        };
        const mineProjects = proj.memberBreakdowns[user.name] || [];
        // Project hours are driven by the breakdown total, not typed.
        const projectDays = mineProjects.reduce(
          (s, p) => s + (Number(p.days) || 0),
          0
        );
        const mine = { ...raw, project: projectDays };
        setRow(mine);
        setProjects(mineProjects);
        setCatalog((cat.projects || []).map((p) => p.name));
        setSaved(serialize(mine, mineProjects));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [weekId, user.name]);

  const dirty = !loading && row != null && serialize(row, projects) !== saved;

  const saver = useCallback(async () => {
    const fields = {};
    for (const f of SPRINT_FIELDS) fields[f.key] = Number(row[f.key]) || 0;
    await api.putSprint(weekId, user.name, fields);
    await api.putProjects(weekId, user.name, projects);
    setSaved(serialize(row, projects));
  }, [weekId, user.name, row, projects]);

  useTabSave(saver, dirty);

  // "Project" hours auto-equal the total days entered in the project breakdown.
  const projectDays = useMemo(
    () => projects.reduce((s, p) => s + (Number(p.days) || 0), 0),
    [projects]
  );
  useEffect(() => {
    setRow((r) => (r && r.project !== projectDays ? { ...r, project: projectDays } : r));
  }, [projectDays]);

  function changeWeek(next) {
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Switch week without saving?')
    ) {
      return;
    }
    setWeekId(next);
  }

  function updateField(key, raw) {
    let v = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(5, v));
    setRow((r) => ({ ...r, [key]: v }));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton rows={2} />
        <Skeleton rows={3} />
      </div>
    );
  }

  const total = rowTotal(row);
  const totalDev = rowTotalDev(row);
  const offTarget = total !== EXPECTED_TOTAL;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector value={weekId} onChange={changeWeek} />
        {dirty && (
          <span className="text-xs font-medium text-amber-600">
            Unsaved changes — use Save in the header
          </span>
        )}
      </div>

      {/* Sprint hours card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-3">My Sprint Report</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SPRINT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {f.label}
              </label>
              {f.key === 'project' ? (
                <input
                  type="number"
                  value={projectDays}
                  readOnly
                  title="Auto-calculated from your project breakdown below"
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-center text-sm text-slate-700 cursor-not-allowed outline-none"
                />
              ) : (
                <NumberInput
                  value={row[f.key] ?? 0}
                  onChange={(v) => updateField(f.key, v)}
                />
              )}
              <p className="mt-1 text-[10px] leading-tight text-slate-400">
                {f.key === 'project'
                  ? 'Auto = total days in your project breakdown below'
                  : f.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm">
            <span className="text-slate-500">Total</span>{' '}
            <span className="font-bold text-brand-800">{total}</span>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">Total Dev</span>{' '}
            <span className="font-bold text-slate-800">{totalDev}</span>
          </div>
          {offTarget && (
            <span className="rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-3 py-1.5 border border-yellow-300">
              Total is {total}, expected {EXPECTED_TOTAL}
            </span>
          )}
        </div>
      </div>

      {/* Project breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-1">What did you work on?</h2>
        <p className="text-xs text-slate-400 mb-3">
          Pick a project from the list or type your own. Helps the admin
          compile the team-wide project summary.
        </p>

        <div className="space-y-2">
          {projects.length === 0 && (
            <p className="text-sm text-slate-400 italic">No projects added yet.</p>
          )}
          {projects.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <ProjectSelect
                className="flex-1"
                value={p.name}
                options={catalog}
                onChange={(v) => {
                  const next = projects.slice();
                  next[i] = { ...next[i], name: v };
                  setProjects(next);
                }}
              />
              <input
                type="number"
                min={0}
                step={0.5}
                value={p.days}
                onChange={(e) => {
                  const next = projects.slice();
                  next[i] = { ...next[i], days: Number(e.target.value) || 0 };
                  setProjects(next);
                }}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setProjects(projects.filter((_, j) => j !== i))}
                className="h-9 w-9 shrink-0 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                aria-label="Delete project"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setProjects([...projects, { name: '', days: 0 }])}
          className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition"
        >
          + Add project
        </button>
      </div>
    </div>
  );
}
