import { StudioGate } from '@/components/gates/StudioGate';
import { UploadProgressBanner } from '@/components/UploadProgressBanner';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudioGate>
      <div className="mx-auto max-w-4xl px-5 md:px-12">
        <UploadProgressBanner />
      </div>
      {children}
    </StudioGate>
  );
}
