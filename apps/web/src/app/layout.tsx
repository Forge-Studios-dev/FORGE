import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'FORGE – Learn from Creators', template: '%s | FORGE' },
  description: 'A skill-first live creator platform. Learn crafts, tech, art, music and more from expert creators through video tutorials and live sessions.',
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
      <body className={`${inter.variable} font-sans bg-surface-primary text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
