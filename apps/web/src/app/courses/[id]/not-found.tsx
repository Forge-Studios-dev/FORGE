import { StatusPage } from '@forge/design-system';

export default function CourseNotFound() {
  return (
    <StatusPage
      icon="school"
      title="Course doesn't exist"
      description="This course may have been removed, unpublished, or the link is out of date."
      action={{ label: 'Browse courses', href: '/discover/courses' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
