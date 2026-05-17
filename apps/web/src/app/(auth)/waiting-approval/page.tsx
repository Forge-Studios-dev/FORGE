'use client';

import { StatusPage } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

export default function WaitingApprovalPage() {
  const { user } = useAuth();
  const name = user?.displayName ? `${user.displayName}, ` : '';

  return (
    <StatusPage
      icon="hourglass_top"
      title="Creator approval pending"
      description={`${name}your creator request is under review. You can still browse and watch tutorials while you wait.`}
      action={{ label: 'Go to home', href: '/' }}
      secondary={{ label: 'Switch account', href: '/login' }}
    />
  );
}
