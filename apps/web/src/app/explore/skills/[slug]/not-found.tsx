import { StatusPage } from '@forge/design-system';

export default function TopicNotFound() {
  return (
    <StatusPage
      icon="search_off"
      title="Topic not found"
      description="This topic doesn't exist or may have been renamed."
      action={{ label: 'Explore', href: '/explore' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
