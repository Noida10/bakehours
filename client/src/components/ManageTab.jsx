import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { useTabSave } from './SaveContext';
import Skeleton from './Skeleton';

// Base members ship in code and cannot be removed; admins can add/remove the
// rest. Kept in sync with server/lib/names.js BASE_DEV_MEMBERS.
const BASE_MEMBERS = [
  'Anmol', 'Vinay', 'Roshan', 'Chandrakesh', 'Pavan',
  'Harit', 'Sushobhita', 'Divya',
];

export default function ManageTab() {
  return (
    <div className="space-y-6">
      <ProjectCatalog />
      <TeamMembers />
    </div>
  );
}

function ProjectCatalog() {
  const toast = useToast();
  const [projects, setProjects] = useState(null);
  const [saved, setSaved] = useState('[]');

  useEffect(() => {
    api
      .getCatalog()
      .then((c) => {
        setProjects(c.projects || []);
        setSaved(JSON.stringify(c.projects || []));
      })
      .catch(() => {
        toast.show('Failed to load projects', { type: 'error' });
        setProjects([]);
      });
  }, []);

  const dirty = projects != null && JSON.stringify(projects) !== saved;

  const saver = useCallback(async () => {
    const data = await api.putCatalog(projects || []);
    setProjects(data.projects || []);
    setSaved(JSON.stringify(data.projects || []));
  }, [projects]);

  useTabSave(saver, dirty);

  if (!projects) {
    return (
      <Panel title="Projects" subtitle="Shared list members pick from.">
        <Skeleton rows={3} />
      </Panel>
    );
  }

  return (
    <Panel
      title="Projects"
      subtitle="Add the projects your team works on, then press Save in the header. Members pick these from a dropdown when logging hours (they can still type a custom one)."
    >
      <div className="space-y-2">
        {projects.length === 0 && (
          <p className="text-sm text-slate-400 italic">No projects yet.</p>
        )}
        {projects.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={p.name}
              placeholder="Project name"
              onChange={(e) => {
                const next = projects.slice();
                next[i] = { name: e.target.value };
                setProjects(next);
              }}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setProjects(projects.filter((_, j) => j !== i))}
              className="h-9 w-9 shrink-0 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete project"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setProjects([...projects, { name: '' }])}
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          + Add project
        </button>
        {dirty && (
          <span className="text-xs font-medium text-amber-600">
            Unsaved — use Save in the header
          </span>
        )}
      </div>
    </Panel>
  );
}

function TeamMembers() {
  const toast = useToast();
  const [members, setMembers] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getRoster()
      .then((r) => setMembers(r.devMembers || []))
      .catch(() => {
        toast.show('Failed to load members', { type: 'error' });
        setMembers([]);
      });
  }, []);

  function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    api
      .addMember(name)
      .then((r) => {
        setMembers(r.devMembers || []);
        setNewName('');
        toast.show(`Added ${r.added}`);
      })
      .catch((e) => toast.show(e.message || 'Could not add member', { type: 'error' }))
      .finally(() => setBusy(false));
  }

  function remove(name) {
    api
      .removeMember(name)
      .then((r) => {
        setMembers(r.devMembers || []);
        toast.show(`Removed ${r.removed}`);
      })
      .catch((e) => toast.show(e.message || 'Could not remove', { type: 'error' }));
  }

  if (!members) {
    return (
      <Panel title="Team members" subtitle="People who submit reports.">
        <Skeleton rows={3} />
      </Panel>
    );
  }

  return (
    <Panel
      title="Team members"
      subtitle="Add or remove teammates. These take effect immediately (no Save needed). New members can log in and appear in the team tables and exports."
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {members.map((name) => {
          const base = BASE_MEMBERS.includes(name);
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {name}
              {base ? (
                <span className="text-[10px] text-slate-400">core</span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          placeholder="New member name"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add member
        </button>
      </div>
    </Panel>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}
