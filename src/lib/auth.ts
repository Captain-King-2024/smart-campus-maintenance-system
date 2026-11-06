import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { repositories } from '@/repositories';
import { check } from './errors';
import type { User } from '@/types/models';
export interface AuthProvider {
  currentUser(): Promise<User | null>;
}
const sessionState = globalThis as unknown as {
  campusSessions?: Map<string, { userId: number; expires: number }>;
};
const sessions = (sessionState.campusSessions ??= new Map());
const cookieName = 'campus_demo_session';
export const auth: AuthProvider = {
  async currentUser() {
    const token = (await cookies()).get(cookieName)?.value;
    const s = token ? sessions.get(token) : null;
    if (!s) return null;
    if (s.expires < Date.now()) {
      sessions.delete(token!);
      return null;
    }
    const u = await repositories.users.findById(s.userId);
    return u?.status === 'ACTIVE' ? u : null;
  },
};
export async function requireUser() {
  const u = await auth.currentUser();
  check(u, 'Please sign in', 401);
  return u;
}
export async function login(userId: number) {
  const user = await repositories.users.findById(userId);
  check(user?.status === 'ACTIVE', 'Demo account unavailable', 400);
  await logout();
  for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId, expires: Date.now() + 8 * 3600000 });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 3600,
  });
  return user;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) sessions.delete(token);
  jar.delete(cookieName);
}
// DATABASE TODO: replace this demo provider with real credential verification,
// password hashing and durable expiring sessions. Role selection is intentionally public.
