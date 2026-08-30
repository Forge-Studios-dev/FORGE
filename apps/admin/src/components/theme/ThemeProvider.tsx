'use client';

import { ThemeProvider as SharedThemeProvider, useTheme } from '@forge/design-system/client';
import type { ReactNode } from 'react';

export type { ThemeMode } from '@forge/design-system/client';
export { useTheme };

/** Admin theme — defaults dark; separate storage from consumer web. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <SharedThemeProvider storageKey="forge-admin-theme" preferSystemLight={false}>
      {children}
    </SharedThemeProvider>
  );
}
