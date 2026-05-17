import Link from 'next/link';
import { PageHeader } from '@forge/design-system';

export default function UploadSuccessPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-20 text-center md:px-12">
      <PageHeader title="Lesson published!" subtitle="Your content is processing and will appear when ready" />
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/studio/videos" className="primary-button rounded-full px-6 py-3 font-semibold text-on-primary">
          View in Studio
        </Link>
        <Link href="/" className="rounded-full border border-outline-variant px-6 py-3 hover:border-primary">
          Back home
        </Link>
      </div>
    </main>
  );
}
