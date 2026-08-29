import { StatusPage } from '@forge/design-system';

export default function StudioNotFound() {
  return (
    <StatusPage
      icon="space_dashboard"
      title="Studio page not found"
      description="That Studio route doesn’t exist or the content was removed."
      action={{ label: 'Studio home', href: '/studio' }}
      secondary={{ label: 'Upload', href: '/upload' }}
    />
  );
}
