import { StatusPage } from '@forge/design-system';

export default function WatchNotFound() {
  return (
    <StatusPage
      icon="videocam_off"
      title="Video unavailable"
      description="This video may have been removed or is still processing."
      action={{ label: 'Back home', href: '/' }}
      secondary={{ label: 'Explore', href: '/explore' }}
    />
  );
}
