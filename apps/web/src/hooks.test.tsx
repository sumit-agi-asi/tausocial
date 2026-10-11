import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { messageOf, useAsync } from './hooks';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('async hooks', () => {
  it('formats errors and falls back for non-Error values', () => {
    expect(messageOf(new Error('broken'))).toBe('broken');
    expect(messageOf('broken')).toBe('Something went wrong');
  });

  it('loads data, reloads, and reports failures', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce('unknown');
    const { result } = renderHook(() => useAsync(load, []));

    await waitFor(() => expect(result.current.data).toBe('first'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe('offline'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe('Something went wrong'));
  });

  it('ignores responses from superseded requests', async () => {
    const oldRequest = deferred<string>();
    const currentRequest = deferred<string>();
    const load = vi.fn(({ key }: { key: number }) => (key === 1 ? oldRequest.promise : currentRequest.promise));
    const { result, rerender } = renderHook(({ key }) => useAsync(() => load({ key }), [key]), {
      initialProps: { key: 1 }
    });

    rerender({ key: 2 });
    await act(async () => currentRequest.resolve('current'));
    await waitFor(() => expect(result.current.data).toBe('current'));
    await act(async () => oldRequest.resolve('stale'));
    expect(result.current.data).toBe('current');
  });

  it('ignores errors from superseded requests', async () => {
    const oldRequest = deferred<string>();
    const currentRequest = deferred<string>();
    const load = vi.fn(({ key }: { key: number }) => (key === 1 ? oldRequest.promise : currentRequest.promise));
    const { result, rerender } = renderHook(({ key }) => useAsync(() => load({ key }), [key]), {
      initialProps: { key: 1 }
    });

    rerender({ key: 2 });
    await act(async () => oldRequest.reject(new Error('stale')));
    expect(result.current.error).toBeNull();
    await act(async () => currentRequest.resolve('current'));
    await waitFor(() => expect(result.current.data).toBe('current'));
  });
});
