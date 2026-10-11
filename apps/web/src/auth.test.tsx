import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { AuthProvider, useAuth } from './auth';
import { me, signedIn } from './testing/fixtures';

function Probe() {
  const { user } = useAuth();
  return (
    <>
      <p>{user?.username ?? 'anonymous'}</p>
      <button onClick={() => void api.me().catch(() => undefined)}>Call API</button>
    </>
  );
}

describe('authentication API integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => me
      })
    );
  });

  it('uses the cached session token when refreshing the user profile', async () => {
    signedIn();
    const fetchMock = vi.mocked(fetch);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/me'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer ' + 't' }) })
      )
    );
    expect(await screen.findByText('alice')).toBeInTheDocument();
  });

  it('omits auth headers for anonymous API calls', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'unauthorized', message: 'Authentication required' } })
    } as Response);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Call API' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });
});
