import { writable } from 'svelte/store';

const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('snow_user') : null;
export const user = writable(storedUser ? JSON.parse(storedUser) : null);

export function setUser(userData) {
  user.set(userData);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('snow_user', JSON.stringify(userData));
  }
}

export function clearUser() {
  user.set(null);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('snow_user');
  }
}

export const selectedEvent = writable(null);

export const toast = writable({ show: false, message: '', type: 'info' });

let toastTimer = null;
export function showToast(message, type = 'info', duration = 3000) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.set({ show: true, message, type });
  toastTimer = setTimeout(() => {
    toast.set({ show: false, message: '', type: 'info' });
  }, duration);
}

export const alertRefreshTrigger = writable(0);
export function refreshAlerts() {
  alertRefreshTrigger.update((n) => n + 1);
}
