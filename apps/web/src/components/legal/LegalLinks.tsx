import Link from 'next/link';

type Props = {
  className?: string;
  linkClassName?: string;
  separator?: string;
  /** Footer / support nav — includes DMCA notice form. */
  includeCopyright?: boolean;
};

/** Inline Terms + Privacy (+ optional Copyright) links for forms and footers. */
export function LegalLinks({
  className = '',
  linkClassName = 'text-primary hover:underline',
  separator = ' · ',
  includeCopyright = false,
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
      {includeCopyright ? (
        <>
          {separator}
          <Link href="/copyright/notice" className={linkClassName} target="_blank" rel="noopener noreferrer">
            Copyright
          </Link>
        </>
      ) : null}
    </span>
  );
}
