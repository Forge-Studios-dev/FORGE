import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { permanentRedirect } from 'next/navigation';
import { redirectIfStaleProfileUsername } from './username-redirect';

describe('redirectIfStaleProfileUsername', () => {
  it('no-ops when path matches canonical (case-insensitive)', () => {
    expect(() => redirectIfStaleProfileUsername('Alice', 'alice')).not.toThrow();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('permanent-redirects to canonical path + suffix', () => {
    expect(() =>
      redirectIfStaleProfileUsername('old_name', 'new_name', '/subscribers'),
    ).toThrow('REDIRECT:/new_name/subscribers');
    expect(permanentRedirect).toHaveBeenCalledWith('/new_name/subscribers');
  });
});
