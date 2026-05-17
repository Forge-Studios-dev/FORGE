import Link from 'next/link';
import type { ReactNode } from 'react';

export const authFieldClass =
  'w-full border-b border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition placeholder:text-outline focus:border-primary';

export const authLabelClass = 'font-label-caps mb-2 block text-outline';

type AuthScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showHeader?: boolean;
};

export function AuthScreen({ title, subtitle, children, footer, showHeader = true }: AuthScreenProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[10%] -top-[20%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -left-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>
      {showHeader ? (
        <header className="fixed left-0 top-0 z-50 flex h-16 w-full items-center border-b border-outline-variant/20 bg-surface/60 px-5 backdrop-blur-[30px] md:px-12">
          <Link href="/" className="font-display-forge text-xl font-bold text-primary">
            FORGE
          </Link>
        </header>
      ) : null}
      <div className="glass-panel relative z-10 w-full max-w-md rounded-3xl p-8 md:p-12">
        {!showHeader ? (
          <Link href="/" className="font-display-forge mb-8 inline-block text-xl font-bold text-primary">
            FORGE
          </Link>
        ) : null}
        <div className={showHeader ? 'mb-10 mt-12' : 'mb-8'}>
          <h1 className="font-display-forge mb-2 text-3xl font-bold">{title}</h1>
          {subtitle ? <p className="text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {children}
        {footer}
      </div>
    </main>
  );
}
