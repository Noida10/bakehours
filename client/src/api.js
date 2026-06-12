// Thin fetch wrapper. Every authenticated request carries the resolved
// user name in the x-user-name header.

let currentUser = null;

export function setApiUser(name) {
  currentUser = name;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (currentUser) headers['x-user-name'] = currentUser;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method,
    headers,
    cache: 'no-store',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // 304 can surface to fetch behind a CDN; treat it as a successful read.
  if (!res.ok && res.status !== 304) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  validateName: (name) =>
    request(`/api/validate-name?name=${encodeURIComponent(name)}`),
  getSprint: (weekId) => request(`/api/sprint/${weekId}`),
  putSprint: (weekId, member, fields) =>
    request(`/api/sprint/${weekId}/${encodeURIComponent(member)}`, {
      method: 'PUT',
      body: fields,
    }),
  getVacation: (month) => request(`/api/vacation/${month}`),
  putVacation: (month, member, entries) =>
    request(`/api/vacation/${month}/${encodeURIComponent(member)}`, {
      method: 'PUT',
      body: entries,
    }),
  getProjects: (weekId) => request(`/api/projects/${weekId}`),
  putProjects: (weekId, member, entries) =>
    request(`/api/projects/${weekId}/${encodeURIComponent(member)}`, {
      method: 'PUT',
      body: { entries },
    }),
  putCompiled: (weekId, compiledSummary) =>
    request(`/api/projects/${weekId}/compiled`, {
      method: 'PUT',
      body: { compiledSummary },
    }),

  // Shared project catalog.
  getCatalog: () => request('/api/catalog'),
  putCatalog: (projects) =>
    request('/api/catalog', { method: 'PUT', body: { projects } }),

  // Storage/persistence status.
  getHealth: () => request('/api/health'),

  // Roster.
  getRoster: () => request('/api/roster'),
  addMember: (name) =>
    request('/api/roster-admin/members', { method: 'POST', body: { name } }),
  removeMember: (name) =>
    request(`/api/roster-admin/members/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),
};

// Build a download URL; the name is appended as a query param because
// anchor/window navigation cannot send custom headers.
export function downloadUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}__name=${encodeURIComponent(currentUser || '')}`;
}
