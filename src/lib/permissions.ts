import type { User } from '../types';

export function hasPermission(user: User | null, permission?: string) {
  if (!permission) return true;
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.permissions?.includes('*') || user.permissions?.includes(permission);
}
