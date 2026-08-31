import { describe, expect, it } from 'vitest';
import { filterBrowserExtensionErrors, isBrowserExtensionError } from '../src/lib/sentryFilters';

describe('Sentry browser-extension error filtering', () => {
  it('filters the reported Tab-not-found runtime.sendMessage error', () => {
    const event = {
      exception: {
        values: [{
          type: 'Error',
          value: 'Invalid call to runtime.sendMessage(). Tab not found.',
        }],
      },
    };

    expect(isBrowserExtensionError(event)).toBe(true);
    expect(filterBrowserExtensionErrors(event)).toBeNull();
  });

  it('also filters the same error when it is only present on the original exception', () => {
    const event = { message: 'Uncaught Error' };
    const hint = {
      originalException: new Error('Invalid call to runtime.sendMessage(). Tab not found.'),
    };

    expect(filterBrowserExtensionErrors(event, hint)).toBeNull();
  });

  it('keeps application errors for Sentry', () => {
    const event = {
      exception: {
        values: [{ type: 'Error', value: 'Unable to load course data' }],
      },
    };

    expect(isBrowserExtensionError(event)).toBe(false);
    expect(filterBrowserExtensionErrors(event)).toBe(event);
  });
});
