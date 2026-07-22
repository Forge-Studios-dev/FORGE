import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's auto-cleanup relies on a *global* afterEach,
// which Vitest only provides when `test.globals: true` is set (it isn't
// here — tests import afterEach/describe/it explicitly instead). Without
// this, render() output from one test leaks into the next, so anything
// querying by role/text across more than one `it()` block sees duplicates.
afterEach(() => cleanup());
