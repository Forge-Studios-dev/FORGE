import Link from 'next/link';
import { StatusPage } from '@forge/design-system';

export default function NotFound() {
  return (
    <StatusPage
      icon="search_off"
      title="Page not found"
      description="This page doesn't exist or may have been moved."
      action={{ label: 'Back home', href: '/' }}
      secondary={{ label: 'Explore', href: '/explore' }}
    />
  );
}
