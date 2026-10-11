import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { AuthProvider, useAuth } from './auth';
import { Composer } from './components/Composer';
import { FlagBadge } from './components/FlagBadge';
import { EmptyState, ErrorState, Popup } from './components/Notice';
import { PostCard } from './components/PostCard';
import { Field } from './pages/AuthPages';
import { SettingsPage } from './pages/SettingsPage';
import { VerifyPage } from './pages/VerifyPage';
import { makePost, me, signedIn } from './testing/fixtures';

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return {
    ...original,
    api: {
      ...original.api,
      me: vi.fn(),
      createPost: vi.fn(),
      editPost: vi.fn(),
      deletePost: vi.fn(),
      react: vi.fn(),
      unreact: vi.fn(),
      report: vi.fn(),
      updateMe: vi.fn(),
      deleteMe: vi.fn(),
      submitVerification: vi.fn()
    }
  };
});

function withAuth(element: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{element}</AuthProvider>
    </MemoryRouter>
  );
}

function AuthProbe() {
  const { user, setUser } = useAuth();
  return (
    <>
      <p>{user?.username ?? 'signed out'}</p>
      <button onClick={() => setUser(me)}>Set profile</button>
    </>
  );
}

describe('shared components', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(api.me).mockResolvedValue(me);
    vi.mocked(api.createPost).mockReset();
    vi.mocked(api.editPost).mockReset();
    vi.mocked(api.deletePost).mockReset();
    vi.mocked(api.react).mockReset();
    vi.mocked(api.unreact).mockReset();
    vi.mocked(api.report).mockReset();
    vi.mocked(api.updateMe).mockReset();
    vi.mocked(api.deleteMe).mockReset();
    vi.mocked(api.submitVerification).mockReset();
    signedIn();
  });

  it('recovers from malformed cached sessions and ignores profile updates without a session', async () => {
    sessionStorage.setItem('tausocial.session', '{');
    withAuth(<AuthProbe />);
    expect(screen.getByText('signed out')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Set profile' }));
    expect(sessionStorage.getItem('tausocial.session')).toBe('{');
  });

  it('uses the auth hook only inside its provider', () => {
    expect(() => render(<AuthProbe />)).toThrow('useAuth must be used inside AuthProvider');
  });

  it('silently drops a profile refresh failure', async () => {
    vi.mocked(api.me).mockRejectedValueOnce(new Error('expired'));
    withAuth(<AuthProbe />);
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('renders optional notice content and only closes on Escape or button', async () => {
    const close = vi.fn();
    const { rerender } = render(
      <>
        <ErrorState message="failed" />
        <EmptyState title="empty" />
        <Popup title="dialog" onClose={close}>
          content
        </Popup>
      </>
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();

    rerender(<FlagBadge flag="green" tags={['custom_tag']} />);
    expect(screen.getByText('custom_tag')).toBeInTheDocument();
  });

  it('connects field errors to their inputs accessibly', () => {
    render(<Field label="Username" id="username" error="Required" />);
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'username-error');
  });

  it('renders each media type and handles normal edit errors and cancel', async () => {
    vi.mocked(api.editPost).mockRejectedValueOnce(new Error('edit failed'));
    const user = userEvent.setup();
    withAuth(
      <PostCard
        post={makePost({
          authorId: me.id,
          replyCount: 2,
          media: [
            { kind: 'image', url: 'https://x.example/image.png' },
            { kind: 'video', url: 'https://x.example/video.mp4' },
            { kind: 'audio', url: 'https://x.example/audio.mp3' }
          ]
        })}
        onChange={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.getByRole('img', { name: 'Attached by the author' })).toBeInTheDocument();
    expect(screen.getByLabelText('Attached video')).toBeInTheDocument();
    expect(screen.getByLabelText('Attached audio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 replies/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Post actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Post actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('edit failed');
  });

  it('labels one reply in the thread link', () => {
    withAuth(<PostCard post={makePost({ replyCount: 1 })} onChange={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByRole('link', { name: /1 reply/ })).toBeInTheDocument();
  });

  it('reports when copying a post link fails', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) },
      configurable: true
    });
    withAuth(<PostCard post={makePost()} onChange={vi.fn()} onDeleted={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Post actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    expect(await screen.findByText(/Copy failed/)).toBeInTheDocument();
  });

  it('shows a blocked-post notice when moderation returns no tags', async () => {
    vi.mocked(api.createPost).mockRejectedValueOnce(new ApiError(422, 'content_blocked', 'blocked'));
    const user = userEvent.setup();
    render(<Composer onCreated={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: 'Share something' }), 'blocked content');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('flagged this content as unsafe.');
  });

  it('supports settings and verification without a cached profile', async () => {
    sessionStorage.clear();
    vi.mocked(api.updateMe).mockResolvedValue(me);
    withAuth(
      <>
        <SettingsPage />
        <VerifyPage />
      </>
    );
    expect(screen.getByLabelText('Display name')).toHaveValue('');
    expect(screen.getByLabelText('Likes (comma separated)')).toHaveValue('');
    expect(screen.getByText(/Status:/)).toHaveTextContent('Status:');
    await userEvent.setup().type(screen.getByLabelText('Likes (comma separated)'), ' chess, , music ');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith(expect.objectContaining({ interests: ['chess', 'music'], country: null })));
  });
});
