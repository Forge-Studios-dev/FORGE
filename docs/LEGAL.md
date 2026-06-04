# Legal pages (Terms & Privacy)

Public legal documents for FORGE are served on the **web app**:

| Document | URL |
|----------|-----|
| Terms of Service | `https://forgestudios.net/terms` |
| Privacy Policy | `https://forgestudios.net/privacy` |

## Source of truth

- Content: `apps/web/src/content/legal/terms.ts`, `privacy.ts`
- Metadata: `apps/web/src/content/legal/constants.ts` (`LEGAL_LAST_UPDATED`)
- UI: `apps/web/src/components/legal/LegalDocument.tsx`

Update `LEGAL_LAST_UPDATED` and notify users when making material changes.

## Signup acceptance

Email/password signup requires `acceptedTerms: true` (API `SignupDto` + web checkbox).

Google OAuth users should review terms before continuing; consider an in-product acceptance step in a follow-up if required for compliance.

## API

`GET /api/v1/platform/config` includes a `legal` object with canonical URLs and contact emails.

## Contact

- Legal: legal@forgestudios.net
- Privacy: privacy@forgestudios.net

This document is operational guidance, not legal advice. Have qualified counsel review before production launch in regulated markets.
