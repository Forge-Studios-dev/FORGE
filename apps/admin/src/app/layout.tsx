import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import '@/env';
import './globals.css';
import { AdminProviders } from './providers';
import { AdminShell } from '@/components/AdminShell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: { default: 'FORGE Admin', template: '%s | FORGE Admin' },
  description: 'FORGE platform administration panel',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <AdminProviders>
          <AdminShell>{children}</AdminShell>
        </AdminProviders>
      </body>
    </html>
  );
}
