import { useState, useEffect } from 'react';
import { api } from '../api';
import { BUILD } from '../lib/build';

// Members sign in with their first name. Admins (Anmol, Julien) sign in with
// their private code, so they aren't shown here.
const VALID_NAMES = [
  'Vinay', 'Roshan', 'Chandrakesh', 'Pawan',
  'Harit', 'Sushobhita', 'Divya',
];

export default function EntryScreen({ onEnter }) {
  const [name, setName] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Pre-fill from a previously remembered name.
  useEffect(() => {
    const saved = localStorage.getItem('eitp.name');
    if (saved) setName(saved);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.validateName(name.trim());
      if (!result.valid) {
        setError('Name not recognised. Please check spelling.');
        setBusy(false);
        return;
      }
      if (remember) {
        localStorage.setItem('eitp.name', result.canonicalName);
      } else {
        localStorage.removeItem('eitp.name');
      }
      onEnter(result);
    } catch {
      setError('Could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center text-white text-xl font-bold">
            E
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Equinox India Team Portal
          </h1>
          <p className="text-slate-500 mt-1">Enter your name to continue</p>
          <p className="text-[10px] text-slate-300 mt-1">{BUILD}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Your name"
              autoFocus
              className={`w-full rounded-lg border px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-brand-500 ${
                error ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            {error && (
              <div className="mt-2 text-sm text-red-600">
                {error}
                {error.startsWith('Name not recognised') && (
                  <div className="mt-1 text-slate-500">
                    Valid names: {VALID_NAMES.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Remember me on this device
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 text-white font-semibold hover:bg-brand-700 transition disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
