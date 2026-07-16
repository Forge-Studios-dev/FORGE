import { StatusPage } from '@forge/design-system';

export default function LiveStreamNotFound() {
  return (
    <StatusPage
      icon="live_tv"
      title="Stream not found"
      description="This live stream may have ended, been removed, or the link is out of date."
      action={{ label: 'Browse live now', href: '/live' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
