import { describe, expect, it, vi } from 'vitest';
import { refreshCoursesAfterMutation } from '../src/lib/courseRefresh';

describe('refreshCoursesAfterMutation', () => {
  it('refreshes twice after a publish-like mutation', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);

    const promise = refreshCoursesAfterMutation(refresh, { followupDelayMs: 250 });
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);
    await promise;

    expect(refresh).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('skips the delayed refresh when delay is zero', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await refreshCoursesAfterMutation(refresh, { followupDelayMs: 0 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('uses the protected impersonation refresh when one is supplied', async () => {
    const publicRefresh = vi.fn().mockResolvedValue(undefined);
    const impersonatedRefresh = vi.fn().mockResolvedValue(undefined);

    await refreshCoursesAfterMutation(publicRefresh, {
      followupDelayMs: 0,
      refresh: impersonatedRefresh
    });

    expect(impersonatedRefresh).toHaveBeenCalledTimes(1);
    expect(publicRefresh).not.toHaveBeenCalled();
  });
});
