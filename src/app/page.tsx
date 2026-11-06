import Link from 'next/link';
export default function Landing() {
  return (
    <main className="landing">
      <nav>
        <Link href="/" className="brand">
          <span className="brand-mark">C</span>CampusCare
        </Link>
        <Link className="button secondary" href="/login">
          Demo sign in ↗
        </Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">A BETTER CAMPUS STARTS HERE</div>
        <h1>
          Small issues.
          <br />
          <span>Smarter solutions.</span>
        </h1>
        <p>
          Report a problem, follow the repair, and get back to what matters. One place for every
          campus maintenance request.
        </p>
        <Link href="/login" className="button">
          Open your workspace <span>→</span>
        </Link>
        <div className="hero-meta">5 role-based workspaces · One connected workflow</div>
      </section>
      <section className="features">
        <article>
          <span>01 / REPORT</span>
          <h2>Make it visible</h2>
          <p>Describe the issue and pinpoint its campus location.</p>
        </article>
        <article>
          <span>02 / REPAIR</span>
          <h2>Keep work moving</h2>
          <p>Coordinate technicians, work logs, and materials.</p>
        </article>
        <article>
          <span>03 / RESOLVE</span>
          <h2>Close the loop</h2>
          <p>Track progress and share feedback after resolution.</p>
        </article>
      </section>
      <footer>
        SMART CAMPUS MAINTENANCE & COMPLAINT MANAGEMENT SYSTEM{' '}
        <span>Academic demo · In-memory data</span>
      </footer>
    </main>
  );
}
