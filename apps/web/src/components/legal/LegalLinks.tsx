import Link from 'next/link';

type Props = {
  className?: string;
  linkClassName?: string;
  separator?: string;
};

/** Inline Terms + Privacy links for forms and footers. */
export function LegalLinks({
  className = '',
  linkClassName = 'text-primary hover:underline',
  separator = ' · ',
}: Props) {
  return (
    <span className={className}>
      <Link href="/terms" className={linkClassName} target="_blank" rel="noopener noreferrer">
        Terms of Service
      </Link>
      {separator}
      <Link href="/privacy" className={linkClassName} target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </Link>
    </span>
  );
}
