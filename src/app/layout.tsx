import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'CampusCare | Smart Maintenance',
  description: 'Smart Campus Maintenance and Complaint Management System',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
