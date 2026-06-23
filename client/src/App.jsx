import { useState, useEffect } from 'react';
import { api, setApiUser } from './api';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { SaveProvider, useSave } from './components/SaveContext';
import EntryScreen from './components/EntryScreen';
import SprintTab from './components/SprintTab';
import VacationTab from './components/VacationTab';
import TeamSprintTab from './components/TeamSprintTab';
import TeamVacationTab from './components/TeamVacationTab';
import ManageTab from './components/ManageTab';
import DownloadsTab from './components/DownloadsTab';
import { currentWeekInfo } from './lib/weeks';
import { BUILD } from './lib/build';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore a remembered session. Restore optimistically from storage so a
  // refresh keeps you signed in even if the server is briefly slow/unreachable;
  // revalidate in the background and only sign out if it's *explicitly* invalid.
  useEffect(() => {
    let savedUser = null;
    try {
      savedUser = JSON.parse(localStorage.getItem('eitp.user') || 'null');
    } catch {
      savedUser = null;
    }
    const name = (savedUser && savedUser.name) || localStorage.getItem('eitp.name');

    if (savedUser && savedUser.name) {
      setApiUser(savedUser.name);
      setUser(savedUser);
    }
    setBooting(false);

    if (!name) return;
    api
      .validateName(name)
      .then((res) => {
        if (res && res.valid) {
          const u = {
            name: res.canonicalName,
            role: res.role,
            isAdmin: res.isAdmin,
            canEdit: res.canEdit,
            hasDataRow: res.hasDataRow,
          };
          setApiUser(u.name);
          setUser(u);
          localStorage.setItem('eitp.user', JSON.stringify(u));
          localStorage.setItem('eitp.name', u.name);
        } else if (res && res.valid === false) {
          // Server clearly doesn't recognise the name → sign out.
          localStorage.removeItem('eitp.user');
          localStorage.removeItem('eitp.name');
          setApiUser(null);
          setUser(null);
        }
        // Network/other errors fall through to .catch and keep the session.
      })
      .catch(() => {
        /* keep the optimistic session on transient errors */
      });
  }, []);

  function handleEnter(res) {
    const u = {
      name: res.canonicalName,
      role: res.role,
      isAdmin: res.isAdmin,
      canEdit: res.canEdit,
      hasDataRow: res.hasDataRow,
    };
    setApiUser(u.name);
    setUser(u);
  }

  function signOut() {
    localStorage.removeItem('eitp.name');
    localStorage.removeItem('eitp.user');
    setApiUser(null);
    setUser(null);
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <SaveProvider>
          {!user ? (
            <EntryScreen onEnter={handleEnter} />
          ) : (
            <Dashboard user={user} onSignOut={signOut} />
          )}
        </SaveProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}

function Dashboard({ user, onSignOut }) {
  const [weekId, setWeekId] = useState(currentWeekInfo().id);
  const { dirty } = useSave();

  const tabs = user.isAdmin
    ? [
        { id: 'team-sprint', label: 'Team Sprint Report' },
        { id: 'team-vacation', label: 'Team Vacation Planner' },
        { id: 'manage', label: 'Manage' },
        { id: 'downloads', label: 'Downloads' },
      ]
    : [
        { id: 'my-sprint', label: 'My Sprint Report' },
        { id: 'my-vacation', label: 'My Vacation Plan' },
      ];

  const [active, setActive] = useState(tabs[0].id);

  // Don't silently throw away unsaved edits when moving between tabs.
  function selectTab(id) {
    if (id === active) return;
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Leave without saving?')
    ) {
      return;
    }
    setActive(id);
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
              E
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">
                Equinox India Team Portal
              </h1>
              <p className="text-xs text-slate-400 leading-tight">
                {user.name}
                {user.isAdmin && (
                  <span className="ml-1 rounded bg-brand-100 text-brand-700 px-1.5 py-0.5 text-[10px] font-medium">
                    {user.canEdit ? 'Admin' : 'Admin · view only'}
                  </span>
                )}
                <span className="ml-1 text-slate-300">· {BUILD}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveButton />
            <button
              type="button"
              onClick={onSignOut}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Switch user
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  active === t.id
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <PersistenceBanner />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {active === 'my-sprint' && (
          <SprintTab user={user} weekId={weekId} setWeekId={setWeekId} />
        )}
        {active === 'my-vacation' && <VacationTab user={user} />}
        {active === 'team-sprint' && (
          <TeamSprintTab user={user} weekId={weekId} setWeekId={setWeekId} />
        )}
        {active === 'team-vacation' && <TeamVacationTab user={user} />}
        {active === 'manage' && <ManageTab />}
        {active === 'downloads' && <DownloadsTab />}
      </main>
    </div>
  );
}

// Single Save control shared by every tab. Highlights when there are unsaved
// changes; disabled (and quiet) when everything is saved.
function SaveButton() {
  const { dirty, saving, save } = useSave();

  if (saving) {
    return (
      <span className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white opacity-80">
        Saving…
      </span>
    );
  }

  if (!dirty) {
    return (
      <span className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 border border-slate-200">
        ✓ Saved
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={save}
      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-2 ring-amber-300 animate-pulse hover:bg-amber-600 hover:animate-none"
    >
      ● Save changes
    </button>
  );
}

// Warns when the server isn't persisting data (e.g. no KV store configured on
// Vercel → /tmp is wiped on cold starts), which is the usual cause of data
// "disappearing" after a while.
function PersistenceBanner() {
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    api
      .getHealth()
      .then((h) => setWarn(h && h.persistent === false))
      .catch(() => {});
  }, []);

  if (!warn) return null;

  return (
    <div className="bg-amber-50 border-y border-amber-200 text-amber-800 text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2">
        ⚠ This server isn't saving data permanently — entries can be lost on
        restarts. Connect a KV store (see the README) to persist data.
      </div>
    </div>
  );
}
