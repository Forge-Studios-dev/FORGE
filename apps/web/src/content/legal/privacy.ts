import type { LegalSection } from './constants';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'intro',
    title: '1. Introduction',
    paragraphs: [
      'Forge Studios ("we", "us") operates FORGE (https://forgestudios.net), a video platform for creators and viewers. This Privacy Policy explains how we collect, use, disclose, and protect personal information when you use our websites, APIs, and applications.',
      'By using the Service, you acknowledge this Policy. If you do not agree, please do not use the Service.',
    ],
  },
  {
    id: 'controller',
    title: '2. Who is responsible',
    paragraphs: [
      'Forge Studios is the data controller for personal information processed through FORGE, except where creators process viewer data in connection with their own channels (e.g. community messages), in which case they act as independent controllers for that interaction.',
    ],
  },
  {
    id: 'collect',
    title: '3. Information we collect',
    paragraphs: ['We collect information you provide directly, automatically when you use the Service, and from third parties where permitted.'],
    bullets: [
      'Account data: email, username, display name, password (stored hashed), profile details, creator application information.',
      'Content and activity: videos you upload, live stream metadata, chat and community messages, likes, subscriptions, watch history, and membership status.',
      'Device and usage: IP address, browser type, app version, pages viewed, crash reports, and product analytics events.',
      'Communications: support requests and email verification or notification delivery status.',
      'Payment-related data (when enabled): handled primarily by payment processors; we may receive subscription status and limited billing identifiers.',
    ],
  },
  {
    id: 'use',
    title: '4. How we use information',
    paragraphs: ['We use personal information to:'],
    bullets: [
      'Provide, secure, and improve the Service (authentication, video delivery, live streaming, feeds, search).',
      'Process creator applications, enforce policies, and moderate reported content.',
      'Send transactional emails (verification, password reset, notifications you enable).',
      'Analyze usage to fix bugs, measure performance, and develop features.',
      'Comply with law and protect users, creators, and Forge Studios from fraud and abuse.',
    ],
  },
  {
    id: 'legal-bases',
    title: '5. Legal bases (EEA/UK users)',
    paragraphs: [
      'Where GDPR or similar laws apply, we rely on contract performance (providing the Service), legitimate interests (security, analytics, product improvement), consent (where required, e.g. optional marketing), and legal obligation.',
    ],
  },
  {
    id: 'sharing',
    title: '6. How we share information',
    paragraphs: [
      'We do not sell your personal information. We share data only as described below:',
    ],
    bullets: [
      'Service providers: hosting (e.g. Fly.io, Vercel), database (e.g. Neon), Redis, email (e.g. Resend), video (Mux), push notifications (Firebase), error monitoring (Sentry), and analytics — under contracts requiring appropriate safeguards.',
      'Creators: when you subscribe, join a membership, or message in a creator community, that creator can see information needed to operate their channel (e.g. display name, membership tier).',
      'Legal and safety: when required by law, court order, or to protect rights, safety, and integrity of the Service.',
      'Business transfers: in connection with a merger, acquisition, or asset sale, with notice where required.',
    ],
  },
  {
    id: 'cookies',
    title: '7. Cookies and similar technologies',
    paragraphs: [
      'We use cookies and local storage for session management (including secure refresh tokens where configured), preferences, and analytics. Browser cookies may be set on forgestudios.net and api.forgestudios.net for authentication.',
      'You can control cookies through browser settings; disabling essential cookies may limit login and core features.',
    ],
  },
  {
    id: 'retention',
    title: '8. Data retention',
    paragraphs: [
      'We retain account and content data while your account is active and for a reasonable period afterward to comply with law, resolve disputes, and enforce agreements.',
      'Logs and analytics may be retained for a shorter period aligned with operational needs. You may request deletion subject to exceptions (e.g. legal holds, backup cycles).',
    ],
  },
  {
    id: 'security',
    title: '9. Security',
    paragraphs: [
      'We implement technical and organizational measures appropriate to the risk, including encryption in transit, hashed passwords, access controls, and monitoring. No method of transmission or storage is 100% secure.',
    ],
  },
  {
    id: 'rights',
    title: '10. Your rights and choices',
    paragraphs: [
      'Depending on your location, you may have rights to access, correct, delete, restrict, or port your personal data, and to object to certain processing. Contact privacy@forgestudios.net to exercise these rights.',
      'You can update profile information in account settings, manage notification preferences where available, and unsubscribe from non-essential emails via links in those messages.',
    ],
  },
  {
    id: 'children',
    title: '11. Children',
    paragraphs: [
      'The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. Contact us if you believe we have done so and we will take appropriate steps.',
    ],
  },
  {
    id: 'international',
    title: '12. International transfers',
    paragraphs: [
      'We may process data in countries other than your own (including the United States and India) where our providers operate. We use appropriate safeguards where required by law.',
    ],
  },
  {
    id: 'changes',
    title: '13. Changes to this Policy',
    paragraphs: [
      'We may update this Privacy Policy. The "Last updated" date at the top reflects the latest version. Material changes may be communicated by email or in-product notice.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact us',
    paragraphs: [
      'Privacy inquiries: privacy@forgestudios.net',
      'General legal: legal@forgestudios.net',
      'Website: https://forgestudios.net',
    ],
  },
];
