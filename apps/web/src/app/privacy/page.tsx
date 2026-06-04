import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { PRIVACY_SECTIONS } from '@/content/legal/privacy';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How FORGE collects, uses, and protects your personal information.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="This policy describes how Forge Studios handles personal information when you use FORGE, including our website, APIs, and mobile applications."
      sections={PRIVACY_SECTIONS}
      alternateHref={{ href: '/terms', label: 'Terms of Service' }}
    />
  );
}
