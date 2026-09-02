import { StatusPage } from '@forge/design-system';

export default function StudioCourseNotFound() {
  return (
    <StatusPage
      icon="school"
      title="Course not found"
      description="This course doesn't exist, or you don't have access to edit it."
      action={{ label: 'Back to courses', href: '/studio/courses' }}
      secondary={{ label: 'Studio home', href: '/studio' }}
    />
  );
}
