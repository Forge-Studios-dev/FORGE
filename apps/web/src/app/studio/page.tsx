import Link from 'next/link';
import { Icon, PageHeader } from '@forge/design-system';

const LINKS = [
  { href: '/studio/videos', label: 'Videos', icon: 'video_library', desc: 'Manage uploads' },
  { href: '/studio/analytics', label: 'Analytics', icon: 'analytics', desc: 'Performance insights' },
  { href: '/studio/comments', label: 'Comments', icon: 'forum', desc: 'Community feedback' },
  { href: '/studio/live', label: 'Go live', icon: 'sensors', desc: 'Start a live session' },
  { href: '/studio/tiers', label: 'Memberships', icon: 'workspace_premium', desc: 'Configure member tiers' },
  { href: '/studio/subscribers', label: 'Subscribers', icon: 'groups', desc: 'Manage members & export' },
  { href: '/studio/communities', label: 'Communities', icon: 'hub', desc: 'Multi-community manager' },
  { href: '/studio/community', label: 'Channels', icon: 'forum', desc: 'Default community channels' },
  { href: '/studio/settings', label: 'Settings', icon: 'settings', desc: 'Channel preferences' },
];

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Creator Studio" subtitle="Upload, teach live, and grow your audience" />
      <div className="mb-8">
        <Link
          href="/upload"
          className="primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-on-primary"
        >
          <Icon name="upload" />
          Upload new lesson
        </Link>
      </div>
      <div className="forge-stagger grid gap-4 sm:grid-cols-2">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="forge-card-hover glass-panel flex items-start gap-4 rounded-xl p-5 transition-colors hover:border-primary/30"
          >
            <Icon name={item.icon} className="text-2xl text-primary" />
            <div>
              <h3 className="font-semibold">{item.label}</h3>
              <p className="text-sm text-on-surface-variant">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
