import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shorts',
  description: 'Watch short-form skill videos from FORGE creators.',
};

export default function ShortsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
