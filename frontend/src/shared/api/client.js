import axios from 'axios';
import { ApiError } from './ApiError.js';

const tokenKey = 'lms.accessToken';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    Accept: 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? null;
    const payload = error.response?.data;

    if (status === 401) {
      window.localStorage.removeItem(tokenKey);
      window.dispatchEvent(new CustomEvent('lms:unauthorized'));
    }

    return Promise.reject(
      new ApiError({
        code: payload?.code,
        details: payload?.details,
        message: payload?.message ?? error.message,
        status
      })
    );
  }
);
