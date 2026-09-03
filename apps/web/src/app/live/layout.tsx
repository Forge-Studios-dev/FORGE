import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live',
  description: 'Watch live skill sessions and upcoming streams on FORGE.',
};

export default function LiveDirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
