export const SPRINT_FIELDS = [
  { key: 'project', label: 'Project', hint: 'Feature/project development work' },
  { key: 'bug', label: 'Bug', hint: 'Bug fixes and resolution' },
  { key: 'training', label: 'Training', hint: 'KnowBe4, KB docs, AI training, onboarding' },
  { key: 'other', label: 'Other', hint: 'GitLab migration, code review, setup, misc' },
  { key: 'meeting', label: 'Meeting', hint: 'All meetings, calls, discussions' },
  { key: 'lead', label: 'Lead', hint: 'Leadership/mentoring tasks' },
  { key: 'off', label: 'Off', hint: 'Leave, holiday, time off' },
];

export const EXPECTED_TOTAL = 5;

export function rowTotal(m) {
  return SPRINT_FIELDS.reduce((s, f) => s + (Number(m?.[f.key]) || 0), 0);
}

export function rowTotalDev(m) {
  return (Number(m?.project) || 0) + (Number(m?.bug) || 0) + (Number(m?.training) || 0);
}

// Vacation cell cycle: empty → V → H → WFH → empty.
export const VAC_CYCLE = { '': 'V', V: 'H', H: 'WFH', WFH: '' };

export const VAC_STYLE = {
  V: 'bg-red-300 text-red-900',
  H: 'bg-yellow-200 text-yellow-900',
  WFH: 'bg-emerald-200 text-emerald-900',
  '': '',
};

export const VAC_LABEL = { V: 'Vacation', H: 'Half Day', WFH: 'Work From Home' };
