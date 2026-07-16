import { StatusPage } from '@forge/design-system';

export default function SkillNotFound() {
  return (
    <StatusPage
      icon="search_off"
      title="Skill not found"
      description="This skill category doesn't exist or may have been renamed."
      action={{ label: 'Explore skills', href: '/explore' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
