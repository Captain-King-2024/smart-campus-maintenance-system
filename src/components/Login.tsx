'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from './api-client';
const demos = [
  {
    id: 1,
    name: 'Anku Sharma',
    role: 'Student',
    description: 'Report and track campus issues',
    icon: 'S',
  },
  {
    id: 2,
    name: 'Dr. Meera Rao',
    role: 'Faculty',
    description: 'Keep teaching spaces working',
    icon: 'F',
  },
  {
    id: 3,
    name: 'Ravi Kumar',
    role: 'Technician',
    description: 'Manage assigned repairs',
    icon: 'T',
  },
  {
    id: 4,
    name: 'Priya Nair',
    role: 'Maintenance Manager',
    description: 'Review, assign, and coordinate',
    icon: 'M',
  },
  {
    id: 5,
    name: 'Campus Admin',
    role: 'Admin',
    description: 'Manage the campus directory',
    icon: 'A',
  },
];
export function Login() {
  const [selected, setSelected] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ redirect: string }>('/auth/login', 'POST', { user_id: selected });
      window.location.assign(result.redirect);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/" className="brand">
          <span className="brand-mark">C</span>CampusCare
        </Link>
        <div>
          <div className="eyebrow">ONE CAMPUS. CONNECTED CARE.</div>
          <h1>
            Good spaces.
            <br />
            Better days.
          </h1>
          <p>From the first report to the final repair, keep every request moving.</p>
          <div className="story-grid">
            <span>
              REPORT
              <br />
              <strong>Clearly.</strong>
            </span>
            <span>
              REPAIR
              <br />
              <strong>Together.</strong>
            </span>
            <span>
              RESOLVE
              <br />
              <strong>Confidently.</strong>
            </span>
          </div>
        </div>
        <small>Smart Campus Maintenance & Complaint Management System</small>
      </section>
      <section className="login-form">
        <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
        <h2>Choose a demo role</h2>
        <p className="muted">Explore the full workflow from a different perspective.</p>
        <div className="role-options">
          {demos.map((d) => (
            <button
              key={d.id}
              className={'role-option ' + (selected === d.id ? 'selected' : '')}
              onClick={() => setSelected(d.id)}
              aria-pressed={selected === d.id}
            >
              <span className="avatar">{d.icon}</span>
              <span>
                <strong>{d.role}</strong>
                <small>
                  {d.name} · {d.description}
                </small>
              </span>
              <span className="radio-dot" />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button full" disabled={busy} onClick={submit}>
          {busy ? 'Opening workspace…' : 'Enter workspace →'}
        </button>
        <p className="demo-note">
          Demo authentication — no passwords required. Data resets when the server restarts. Use
          locally for your project demonstration.
        </p>
      </section>
    </main>
  );
}
