import { useState, useEffect } from 'react';
import { api, setApiUser } from './api';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import EntryScreen from './components/EntryScreen';
import SprintTab from './components/SprintTab';
import VacationTab from './components/VacationTab';
import TeamSprintTab from './components/TeamSprintTab';
import TeamVacationTab from './components/TeamVacationTab';
import ManageTab from './components/ManageTab';
import DownloadsTab from './components/DownloadsTab';
import { currentWeekInfo } from './lib/weeks';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore a remembered session on load.
  useEffect(() => {
    const saved = localStorage.getItem('eitp.name');
    if (!saved) {
      setBooting(false);
      return;
    }
    api
      .validateName(saved)
      .then((res) => {
        if (res.valid) {
          setApiUser(res.canonicalName);
          setUser({
            name: res.canonicalName,
            role: res.role,
            isAdmin: res.isAdmin,
            canEdit: res.canEdit,
            hasDataRow: res.hasDataRow,
          });
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  function handleEnter(res) {
    setApiUser(res.canonicalName);
    setUser({
      name: res.canonicalName,
      role: res.role,
      isAdmin: res.isAdmin,
      canEdit: res.canEdit,
      hasDataRow: res.hasDataRow,
    });
  }

  function signOut() {
    localStorage.removeItem('eitp.name');
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
        {!user ? (
          <EntryScreen onEnter={handleEnter} />
        ) : (
          <Dashboard user={user} onSignOut={signOut} />
        )}
      </ErrorBoundary>
    </ToastProvider>
  );
}

function Dashboard({ user, onSignOut }) {
  const [weekId, setWeekId] = useState(currentWeekInfo().id);

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
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Switch user
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
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
