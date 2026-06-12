import { useState, useMemo } from 'react';
import { downloadUrl } from '../api';
import { weekOptions, defaultVacationRange } from '../lib/weeks';

export default function DownloadsTab() {
  const weeks = useMemo(() => weekOptions(16, 2), []);
  const def = useMemo(() => defaultVacationRange(), []);
  const current = weeks[weeks.length - 3] || weeks[0]; // current week-ish

  const [singleWeek, setSingleWeek] = useState(current.id);
  const [rangeFrom, setRangeFrom] = useState(weeks[Math.max(0, weeks.length - 6)].id);
  const [rangeTo, setRangeTo] = useState(current.id);
  const [vacStart, setVacStart] = useState(def.start);
  const [vacEnd, setVacEnd] = useState(def.end);
  const [combWeek, setCombWeek] = useState(current.id);

  function go(path) {
    window.open(downloadUrl(path), '_blank');
  }

  return (
    <div className="space-y-6">
      <Section title="Sprint Reports" subtitle="Export styled weekly sprint tables.">
        <Field label="Single week">
          <WeekPicker weeks={weeks} value={singleWeek} onChange={setSingleWeek} />
          <DownloadBtn onClick={() => go(`/api/download/sprint/${singleWeek}`)} />
        </Field>

        <Field label="Week range (multi-sheet)">
          <WeekPicker weeks={weeks} value={rangeFrom} onChange={setRangeFrom} />
          <span className="text-slate-400 text-sm">to</span>
          <WeekPicker weeks={weeks} value={rangeTo} onChange={setRangeTo} />
          <DownloadBtn
            onClick={() =>
              go(`/api/download/sprint-range?from=${rangeFrom}&to=${rangeTo}`)
            }
          />
        </Field>
      </Section>

      <Section title="Vacation Planner" subtitle="Color-coded availability export.">
        <Field label="Date range">
          <DateInput value={vacStart} onChange={setVacStart} />
          <span className="text-slate-400 text-sm">to</span>
          <DateInput value={vacEnd} onChange={setVacEnd} />
          <DownloadBtn
            onClick={() =>
              go(`/api/download/vacation?start=${vacStart}&end=${vacEnd}`)
            }
          />
        </Field>
      </Section>

      <Section
        title="Combined Report"
        subtitle="One workbook: sprint, vacation planner, and availability summary."
      >
        <Field label="Sprint week">
          <WeekPicker weeks={weeks} value={combWeek} onChange={setCombWeek} />
        </Field>
        <Field label="Vacation range">
          <DateInput value={vacStart} onChange={setVacStart} />
          <span className="text-slate-400 text-sm">to</span>
          <DateInput value={vacEnd} onChange={setVacEnd} />
          <DownloadBtn
            label="Download combined .xlsx"
            onClick={() =>
              go(
                `/api/download/combined?week=${combWeek}&vacStart=${vacStart}&vacEnd=${vacEnd}`
              )
            }
          />
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      <p className="text-xs text-slate-400 mb-4">{subtitle}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-sm text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function WeekPicker({ weeks, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
    >
      {weeks.map((w) => (
        <option key={w.id} value={w.id}>
          {w.label}
        </option>
      ))}
    </select>
  );
}

function DateInput({ value, onChange }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}

function DownloadBtn({ onClick, label = 'Download .xlsx' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
    >
      ↓ {label}
    </button>
  );
}
