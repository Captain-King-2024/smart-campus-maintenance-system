'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/types/models';
import { api } from './api-client';
const roleLabels = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  TECHNICIAN: 'Technician',
  MAINTENANCE_MANAGER: 'Maintenance Manager',
  ADMIN: 'Administrator',
};
export function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const path = usePathname();
  let links: [string, string, string][] = [];
  if (['STUDENT', 'FACULTY'].includes(user.role))
    links = [
      ['/dashboard', 'Overview', '◫'],
      ['/complaints', 'My complaints', '▤'],
      ['/complaints/new', 'Report an issue', '＋'],
    ];
  if (user.role === 'MAINTENANCE_MANAGER')
    links = [
      ['/manager/dashboard', 'Overview', '◫'],
      ['/manager/complaints', 'All complaints', '▤'],
      ['/manager/technicians', 'Technicians', '♙'],
      ['/manager/teams', 'Maintenance teams', '◈'],
      ['/inventory', 'Inventory', '▦'],
    ];
  if (user.role === 'TECHNICIAN')
    links = [
      ['/technician/dashboard', 'Overview', '◫'],
      ['/technician/assignments', 'My assignments', '▤'],
      ['/inventory', 'Inventory', '▦'],
    ];
  if (user.role === 'ADMIN')
    links = [
      ['/admin/dashboard', 'Overview', '◫'],
      ['/manager/complaints', 'Complaints', '▤'],
      ...['users', 'departments', 'buildings', 'rooms', 'categories', 'teams'].map(
        (x): [string, string, string] => ['/admin/' + x, x[0].toUpperCase() + x.slice(1), '◈'],
      ),
      ['/inventory', 'Inventory', '▦'],
    ];
  async function signout() {
    try {
      await api('/auth/logout', 'POST');
      window.location.assign('/login');
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={links[0][0]}>
          <span className="brand-mark">C</span>CampusCare
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              className={
                path === href || (path.startsWith(href + '/') && href != '/complaints')
                  ? 'active'
                  : ''
              }
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mode-dot" />
          Mock data workspace<p>Changes last for this server session.</p>
          <Link href="/login">Switch demo role ↗</Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumb">
            Campus operations <span>/</span> {roleLabels[user.role]}
          </span>
          <div className="profile">
            <span className="avatar">
              {user.name
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <button className="text-button" onClick={signout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="workspace">{children}</main>
        <footer className="app-footer">
          CampusCare <span>Academic project · Demo mode</span>
        </footer>
      </div>
    </div>
  );
}
