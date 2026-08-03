import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { headers } from 'next/headers';
import '@/env';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';
import { AuthProvider } from '@/lib/auth';
import { LiveStreamsSocketSync } from '@/components/live/LiveStreamsSocketSync';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: { default: 'FORGE', template: '%s | FORGE' },
  description:
    'Watch videos, Shorts, and live streams from creators you love. Subscribe, save to playlists, and build your library.',
  keywords: ['video', 'creators', 'shorts', 'live streaming', 'subscriptions', 'playlists'],
  openGraph: {
    type: 'website',
    siteName: 'FORGE',
    title: 'FORGE',
    description: 'Watch videos and live streams from creators you love',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            __html: `(function(){try{var t=localStorage.getItem('forge-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary"
        >
          Skip to content
        </a>
        <Providers>
          <AuthProvider>
            <LiveStreamsSocketSync />
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
