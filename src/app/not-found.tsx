import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-page">
      <h1>Page not found</h1>
      <p>This workspace page does not exist.</p>
      <Link href="/login" className="button">
        Back to sign in
      </Link>
    </main>
  );
}
