import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { TERMS_SECTIONS } from '@/content/legal/terms';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for using the FORGE creator learning platform.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro="Please read these terms carefully before using FORGE. They describe your rights and responsibilities as a viewer, creator, or visitor on our platform."
      sections={TERMS_SECTIONS}
      alternateHref={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
