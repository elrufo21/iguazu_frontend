import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import type { LoginResponse, User } from '../types';
import { queryClient } from './query-client';

const baseURL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      queryClient.clear();
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (payload: { username: string; password: string }) =>
    api.post<LoginResponse>('auth/login', payload).then((res) => res.data),
  me: () => api.get<User>('auth/me').then((res) => res.data),
};

export const resourceApi = {
  list: (path: string) => api.get(path).then((res) => res.data),
  create: (path: string, payload: unknown) => api.post(path, payload).then((res) => res.data),
  put: (path: string, payload: unknown) => api.put(path, payload).then((res) => res.data),
  update: (path: string, payload?: unknown) =>
    payload === undefined ? api.patch(path).then((res) => res.data) : api.patch(path, payload).then((res) => res.data),
  post: (path: string, payload?: unknown) =>
    payload === undefined ? api.post(path).then((res) => res.data) : api.post(path, payload).then((res) => res.data),
  download: async (path: string, fallbackName: string) => {
    const res = await api.get(path, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
