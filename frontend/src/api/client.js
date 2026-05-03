import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const tasks = {
  list: (params) => client.get('/tasks', { params }).then((r) => r.data),
  get: (id) => client.get(`/tasks/${id}`).then((r) => r.data),
  create: (data) => client.post('/tasks', data).then((r) => r.data),
  update: (id, data) => client.patch(`/tasks/${id}`, data).then((r) => r.data),
  complete: (id, note) => client.post(`/tasks/${id}/complete`, { note }).then((r) => r.data),
  history: (id) => client.get(`/tasks/${id}/history`).then((r) => r.data),
  delete: (id) => client.delete(`/tasks/${id}`),
  stats: () => client.get('/tasks/stats').then((r) => r.data),
};

export const budget = {
  limits: () => client.get('/budget/limits').then((r) => r.data),
  setLimit: (data) => client.put('/budget/limits', data).then((r) => r.data),
  deleteLimit: (category) => client.delete(`/budget/limits/${encodeURIComponent(category)}`),
  summary: (month) => client.get('/budget/summary', { params: { month } }).then((r) => r.data),
  categories: () => client.get('/budget/categories').then((r) => r.data),
};

export const expenses = {
  list: (params) => client.get('/expenses', { params }).then((r) => r.data),
  create: (data) => client.post('/expenses', data).then((r) => r.data),
  delete: (id) => client.delete(`/expenses/${id}`),
  monthlyTotals: (year) => client.get('/expenses/monthly-totals', { params: { year } }).then((r) => r.data),
};

export const statements = {
  upload: (file) => {
    const form = new FormData();
    form.append('statement', file);
    return client.post('/statements/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  list: () => client.get('/statements').then((r) => r.data),
  get: (id) => client.get(`/statements/${id}`).then((r) => r.data),
  report: (id) => client.get(`/statements/${id}/report`).then((r) => r.data),
  transactions: (id) => client.get(`/statements/${id}/transactions`).then((r) => r.data),
  findings: (id) => client.get(`/statements/${id}/findings`).then((r) => r.data),
  updateFinding: (findingId, action, reason) =>
    client.patch(`/statements/findings/${findingId}`, { action, reason }).then((r) => r.data),
  compare: (id1, id2) =>
    client.get('/statements/compare', { params: { ids: `${id1},${id2}` } }).then((r) => r.data),
};

export const chat = {
  send: (messages) => client.post('/chat', { messages }).then((r) => r.data),
};

export const calendar = {
  authUrl: () => client.get('/calendar/auth').then((r) => r.data),
  events: (limit) => client.get('/calendar/events', { params: { limit } }).then((r) => r.data),
};

export default client;
