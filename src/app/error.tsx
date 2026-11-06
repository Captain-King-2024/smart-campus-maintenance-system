'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-page">
      <h1>Something went wrong</h1>
      <p>Please try loading the workspace again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
