import { StudioGate } from '@/components/gates/StudioGate';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioGate>{children}</StudioGate>;
}
