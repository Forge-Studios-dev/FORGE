import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { headers } from 'next/headers';
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
  // Reading the per-request nonce here (set by middleware) is what makes Next
  // apply it to its own bootstrap <script> tags and forces this layout to
  // render dynamically — both required for the nonce-based CSP to actually
  // match at runtime instead of silently blocking every script.
  headers().get('x-nonce');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('forge-admin-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <AdminProviders>
          <Suspense fallback={<div className="min-h-screen bg-surface-container-lowest" />}>
            <AdminShell>{children}</AdminShell>
          </Suspense>
        </AdminProviders>
      </body>
    </html>
  );
}
