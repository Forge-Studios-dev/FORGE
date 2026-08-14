'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { RealtimeToasts } from '@/components/RealtimeToasts';
import { PlatformBootstrap } from '@/components/PlatformBootstrap';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { MiniPlayerProvider } from '@/lib/miniplayer';
import { MiniPlayerDock } from '@/components/watch/MiniPlayerDock';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MiniPlayerProvider>
          {children}
          <Suspense fallback={null}>
            <MiniPlayerDock />
          </Suspense>
          <PlatformBootstrap />
          <RealtimeToasts />
        </MiniPlayerProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
