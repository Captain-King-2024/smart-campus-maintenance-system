import type { Role, User } from '@/types/models';
import { check } from './errors';
export function allow(user: User, roles: readonly Role[]) {
  check(user.status === 'ACTIVE', 'Account is inactive', 403);
  check(roles.includes(user.role), 'You do not have permission for this action', 403);
}
export const managers: Role[] = ['ADMIN', 'MAINTENANCE_MANAGER'];
export const workers: Role[] = ['ADMIN', 'MAINTENANCE_MANAGER', 'TECHNICIAN'];
export function home(role: Role) {
  return role === 'ADMIN'
    ? '/admin/dashboard'
    : role === 'MAINTENANCE_MANAGER'
      ? '/manager/dashboard'
      : role === 'TECHNICIAN'
        ? '/technician/dashboard'
        : '/dashboard';
}
export function canVisit(user: User, path: string) {
  if (path.startsWith('/admin')) return user.role === 'ADMIN';
  if (path.startsWith('/manager')) return managers.includes(user.role);
  if (path.startsWith('/technician')) return user.role === 'TECHNICIAN';
  if (path === '/inventory') return workers.includes(user.role);
  if (path.startsWith('/complaints') || path === '/dashboard')
    return ['STUDENT', 'FACULTY'].includes(user.role);
  return false;
}
