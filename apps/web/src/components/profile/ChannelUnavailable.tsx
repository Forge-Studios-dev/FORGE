import { StatusPage } from '@forge/design-system';

/** YouTube-parity: channel exists but is unavailable to this viewer (e.g. they blocked you). */
export function ChannelUnavailable() {
  return (
    <StatusPage
      icon="block"
      title="This channel is not available"
      description="You can’t view this channel. It may be private, or the owner has restricted access."
      action={{ label: 'Go home', href: '/' }}
      secondary={{ label: 'Explore', href: '/explore' }}
    />
  );
}
