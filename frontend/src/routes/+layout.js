import { redirect } from '@sveltejs/kit';
import { user } from '$lib/stores/user.js';
import { get } from 'svelte/store';

export async function load({ url }) {
  const currentUser = get(user);
  const pathname = url.pathname;
  if (!currentUser && pathname !== '/login') {
    throw redirect(302, '/login');
  }
  if (currentUser && pathname === '/login') {
    throw redirect(302, '/');
  }
  return {};
}
