'use client';

import { ThemeProvider as SharedThemeProvider, useTheme } from '@forge/design-system/client';
import type { ReactNode } from 'react';

export type { ThemeMode } from '@forge/design-system/client';
export { useTheme };

/** Web app theme — system light preference when unset. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <SharedThemeProvider storageKey="forge-theme" preferSystemLight>
      {children}
    </SharedThemeProvider>
  );
}
