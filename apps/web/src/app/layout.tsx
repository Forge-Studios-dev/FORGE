import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/shell/AppShell';
import { AuthProvider } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: { default: 'FORGE – Learn from Creators', template: '%s | FORGE' },
  description:
    'A skill-first live creator platform. Learn crafts, tech, art, music and more from expert creators through video tutorials and live sessions.',
  keywords: ['learning', 'creators', 'skills', 'live streaming', 'tutorials'],
  openGraph: {
    type: 'website',
    siteName: 'FORGE',
    title: 'FORGE – Learn from Creators',
    description: 'Skill-first live creator platform',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
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
            <AppShell>
              <div id="main-content">{children}</div>
            </AppShell>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
