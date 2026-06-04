/** Display metadata for legal documents — update LAST_UPDATED when content changes. */
export const LEGAL_COMPANY_NAME = 'Forge Studios';
export const LEGAL_PLATFORM_NAME = 'FORGE';
export const LEGAL_WEBSITE = 'https://forgestudios.net';
export const LEGAL_CONTACT_EMAIL = 'legal@forgestudios.net';
export const LEGAL_PRIVACY_EMAIL = 'privacy@forgestudios.net';
export const LEGAL_LAST_UPDATED = '3 June 2026';

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};
