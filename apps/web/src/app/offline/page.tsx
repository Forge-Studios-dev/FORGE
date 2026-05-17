import { StatusPage } from '@forge/design-system';

export default function OfflinePage() {
  return (
    <StatusPage
      icon="wifi_off"
      title="You're offline"
      description="Check your connection and try again."
      action={{ label: 'Retry', href: '/' }}
    />
  );
}
