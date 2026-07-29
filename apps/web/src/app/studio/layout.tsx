import { StudioGate } from '@/components/gates/StudioGate';
import { StudioShell } from '@/components/studio/StudioShell';
import { StudioSystemBanners } from '@/components/studio/StudioSystemBanners';
import { UploadProgressBanner } from '@/components/UploadProgressBanner';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudioGate>
      <StudioShell>
        <StudioSystemBanners />
        <div className="mb-6">
          <UploadProgressBanner />
        </div>
        {children}
      </StudioShell>
    </StudioGate>
  );
}
