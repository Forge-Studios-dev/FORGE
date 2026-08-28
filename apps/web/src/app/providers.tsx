'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { ToastProvider } from '@forge/design-system/client';
import { RealtimeToasts } from '@/components/RealtimeToasts';
import { PlatformBootstrap } from '@/components/PlatformBootstrap';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { MiniPlayerProvider } from '@/lib/miniplayer';
import { MiniPlayerDockLazy } from '@/components/watch/MiniPlayerDockLazy';

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
        <ToastProvider>
          <MiniPlayerProvider>
            {children}
            <Suspense fallback={null}>
              <MiniPlayerDockLazy />
            </Suspense>
            <PlatformBootstrap />
            <RealtimeToasts />
          </MiniPlayerProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
