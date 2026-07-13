import { StatusPage } from '@forge/design-system';

export default function ProfileNotFound() {
  return (
    <StatusPage
      icon="person_off"
      title="Creator not found"
      description="This profile doesn't exist or the username may have changed."
      action={{ label: 'Explore creators', href: '/explore' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
