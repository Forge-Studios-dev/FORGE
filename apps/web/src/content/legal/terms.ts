import type { LegalSection } from './constants';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: '1. Agreement to terms',
    paragraphs: [
      'These Terms of Service ("Terms") govern your access to and use of the FORGE platform, websites, mobile applications, and related services (collectively, the "Service") operated by Forge Studios ("we", "us", or "our").',
      'By creating an account, accessing, or using the Service, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Service.',
    ],
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    paragraphs: [
      'You must be at least 13 years old (or the minimum age required in your country) to use the Service. If you are under 18, you represent that you have parental or guardian consent.',
      'You may not use the Service if you are barred from doing so under applicable law or if we have previously suspended or terminated your account for violation of these Terms.',
    ],
  },
  {
    id: 'accounts',
    title: '3. Accounts and security',
    paragraphs: [
      'You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us promptly at legal@forgestudios.net if you suspect unauthorized access.',
      'You agree to provide accurate registration information and to keep your profile information current. Usernames and display names must not impersonate others or violate our community standards.',
    ],
  },
  {
    id: 'creators',
    title: '4. Creator accounts and content',
    paragraphs: [
      'Creators may upload videos, go live, offer membership tiers, and operate community channels subject to approval and applicable platform policies.',
      'You retain ownership of content you submit. By posting content on FORGE, you grant Forge Studios a worldwide, non-exclusive, royalty-free license to host, store, reproduce, distribute, display, and promote your content solely to operate and improve the Service (including transcoding, thumbnails, and feed distribution).',
      'You represent that you have all rights necessary to upload and monetize your content and that your content does not infringe third-party rights or violate law.',
    ],
    bullets: [
      'Do not upload unlawful, harassing, hateful, sexually exploitative, or dangerously misleading material.',
      'Do not circumvent access controls, scrape the Service at scale, or interfere with infrastructure.',
      'Live streams and chat are subject to moderation; we may remove content or restrict accounts that violate these Terms.',
    ],
  },
  {
    id: 'memberships',
    title: '5. Memberships and payments',
    paragraphs: [
      'Creators may define membership tiers. Where payment processing is enabled, purchases are handled by third-party payment providers; additional terms from those providers may apply.',
      'Mock or promotional memberships offered in test environments are not real financial transactions. Refund, cancellation, and payout rules for paid memberships will be disclosed before checkout when billing features are generally available.',
    ],
  },
  {
    id: 'viewers',
    title: '6. Viewer conduct',
    paragraphs: [
      'You may watch public content, subscribe to channels, subscribe to membership tiers where available, and participate in live chat and community posts in accordance with channel access rules.',
      'You agree not to harass creators or other users, spam chat, attempt to access gated content without entitlement, or use the Service for unauthorized commercial solicitation.',
    ],
  },
  {
    id: 'ip',
    title: '7. Intellectual property',
    paragraphs: [
      'The FORGE name, logos, product design, and platform software are owned by Forge Studios or its licensors. You may not copy, modify, or reverse engineer the Service except as permitted by law.',
      'If you believe content on FORGE infringes your copyright, contact legal@forgestudios.net with sufficient detail for us to evaluate a notice under applicable law.',
    ],
  },
  {
    id: 'third-party',
    title: '8. Third-party services',
    paragraphs: [
      'The Service integrates third parties such as video infrastructure (e.g. Mux), cloud hosting, email delivery, analytics, and error monitoring. Your use of those features may be subject to their terms and privacy practices as described in our Privacy Policy.',
    ],
  },
  {
    id: 'disclaimers',
    title: '9. Disclaimers',
    paragraphs: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
      'We do not guarantee uninterrupted live streaming, specific quality of service, or accuracy of creator-provided educational content. Creators are responsible for their own offerings.',
    ],
  },
  {
    id: 'liability',
    title: '10. Limitation of liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, FORGE STUDIOS AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.',
      'Our aggregate liability for claims relating to the Service will not exceed the greater of (a) amounts you paid us in the twelve months before the claim or (b) one hundred U.S. dollars (USD $100), except where liability cannot be limited under applicable law.',
    ],
  },
  {
    id: 'termination',
    title: '11. Suspension and termination',
    paragraphs: [
      'We may suspend or terminate your account or access to features if you violate these Terms, create risk for other users, or as required by law. You may stop using the Service at any time and request account deletion by contacting us.',
    ],
  },
  {
    id: 'changes',
    title: '12. Changes to these Terms',
    paragraphs: [
      'We may update these Terms from time to time. We will post the revised version with an updated "Last updated" date. Material changes may be communicated via email or in-product notice. Continued use after changes become effective constitutes acceptance.',
    ],
  },
  {
    id: 'law',
    title: '13. Governing law and disputes',
    paragraphs: [
      'These Terms are governed by the laws of India, without regard to conflict-of-law principles, except where mandatory consumer protections in your country require otherwise.',
      'You agree to attempt informal resolution by contacting legal@forgestudios.net before initiating formal proceedings, where permitted by law.',
    ],
  },
  {
    id: 'contact',
    title: '14. Contact',
    paragraphs: [
      'Questions about these Terms: legal@forgestudios.net',
      'Forge Studios — FORGE Platform, https://forgestudios.net',
    ],
  },
];
