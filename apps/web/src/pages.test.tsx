import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { makeFeedItem, makePost, me, mockApi, renderApp, signedIn } from './testing/fixtures';

const mocks = vi.hoisted(() => ({ api: {} as Record<string, ReturnType<typeof vi.fn>> }));

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return { ...original, api: mocks.api };
});

beforeEach(() => {
  sessionStorage.clear();
  Object.keys(mocks.api).forEach((key) => delete mocks.api[key]);
  Object.assign(mocks.api, mockApi());
});

describe('authentication', () => {
  it('redirects anonymous users to login and logs in', async () => {
    const user = userEvent.setup();
    mocks.api['login']!.mockResolvedValue({ token: 't', user: me });
    renderApp('/feed');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Your feed' })).toBeInTheDocument();
    expect(mocks.api['login']).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'correct-horse-battery' });
    expect(sessionStorage.getItem('tausocial.session')).toContain('"token":"t"');
  });

  it('shows login errors accessibly', async () => {
    const user = userEvent.setup();
    mocks.api['login']!.mockRejectedValue(new ApiError(401, 'unauthorized', 'Invalid email or password'));
    renderApp('/login');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('signs up and continues to verification', async () => {
    const user = userEvent.setup();
    mocks.api['register']!.mockResolvedValue({ token: 't', user: me });
    renderApp('/signup');
    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText(/Password/), 'correct-horse-battery');
    await user.type(screen.getByLabelText('Date of birth'), '1990-01-01');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Verify your identity' })).toBeInTheDocument();
    expect(mocks.api['register']).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'correct-horse-battery',
      birthDate: '1990-01-01'
    });
  });

  it('logs out', async () => {
    const user = userEvent.setup();
    signedIn();
    renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('tausocial.session')).toBeNull();
  });

  it('redirects signed-in users away from login and handles unknown routes', async () => {
    signedIn();
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Your feed' })).toBeInTheDocument();
  });

  it('shows not found for unknown routes', async () => {
    signedIn();
    renderApp('/nope');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('feed', () => {
  beforeEach(() => signedIn());

  it('shows loading then an empty state', async () => {
    renderApp('/feed');
    expect(screen.getByRole('status')).toHaveTextContent(/Loading your feed/);
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    const user = userEvent.setup();
    mocks.api['feed']!.mockRejectedValueOnce(new Error('Cannot reach TauSocial'));
    renderApp('/feed');
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach TauSocial');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders posts with flag labels, tags and bubbles', async () => {
    mocks.api['feed']!.mockResolvedValue({
      items: [
        makeFeedItem({ id: 'p1', flag: 'green' }),
        makeFeedItem({ id: 'p2', body: 'Dubious', flag: 'yellow', tags: ['fake_news'] }),
        makeFeedItem({ id: 'p3', body: 'Pic', media: [{ kind: 'image', url: 'https://x.example/a.png' }] })
      ],
      recommender: 'chronological'
    });
    mocks.api['bubbles']!.mockResolvedValue({
      bubbles: [{ userId: 'u3', username: 'carol', latestPostId: 'p9', latestPostAt: '2026-02-01T00:00:00Z' }]
    });
    renderApp('/feed');
    expect(await screen.findByText('Dubious')).toBeInTheDocument();
    expect(screen.getByText(/Caution: possibly fake or altered/)).toBeInTheDocument();
    expect(screen.getByText('Fake news')).toBeInTheDocument();
    expect(screen.getAllByText(/Safe/).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Attached by the author' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recent post by carol' })).toHaveAttribute('href', '/thread/p9');
  });

  it('publishes a post and refreshes', async () => {
    const user = userEvent.setup();
    mocks.api['createPost']!.mockResolvedValue(makePost());
    renderApp('/feed');
    await screen.findByText('Nothing here yet');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Write something first.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Share something' }), 'My update');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(mocks.api['createPost']).toHaveBeenCalledWith({ body: 'My update', parentId: undefined, media: [] }));
    await waitFor(() => expect(mocks.api['feed']).toHaveBeenCalledTimes(2));
  });

  it('shows a popup when moderation blocks a post', async () => {
    const user = userEvent.setup();
    mocks.api['createPost']!.mockRejectedValue(
      new ApiError(422, 'content_blocked', 'blocked', { flag: 'red', action: 'block', tags: ['abuse'] })
    );
    renderApp('/feed');
    await user.type(await screen.findByRole('textbox', { name: 'Share something' }), 'nasty');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('This post was not published');
    expect(dialog).toHaveTextContent('abuse');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows other composer errors and media options', async () => {
    const user = userEvent.setup();
    mocks.api['createPost']!.mockRejectedValue(new Error('Server exploded'));
    renderApp('/feed');
    await user.type(await screen.findByRole('textbox', { name: 'Share something' }), 'hello');
    await user.selectOptions(screen.getByLabelText('Media type'), 'video');
    await user.type(screen.getByLabelText(/Media link/), 'https://x.example/v.mp4');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(mocks.api['createPost']).toHaveBeenCalledWith(
      expect.objectContaining({ media: [{ kind: 'video', url: 'https://x.example/v.mp4' }] })
    );
  });

  it('reacts with thumbs up and toggles off', async () => {
    const user = userEvent.setup();
    mocks.api['feed']!.mockResolvedValue({ items: [makeFeedItem()], recommender: 'chronological' });
    mocks.api['react']!.mockResolvedValue(makePost({ upvotes: 1, myReaction: 'up' }));
    mocks.api['unreact']!.mockResolvedValue(makePost());
    renderApp('/feed');
    const up = await screen.findByRole('button', { name: /Thumbs up/ });
    await user.click(up);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thumbs up, 1' })).toHaveAttribute('aria-pressed', 'true'));
    await user.click(screen.getByRole('button', { name: 'Thumbs up, 1' }));
    await waitFor(() => expect(mocks.api['unreact']).toHaveBeenCalledWith('p1'));
    await user.click(screen.getByRole('button', { name: /Thumbs down/ }));
    expect(mocks.api['react']).toHaveBeenCalledWith('p1', 'down');
  });

  it('refreshes on demand', async () => {
    const user = userEvent.setup();
    renderApp('/feed');
    await screen.findByText('Nothing here yet');
    await user.click(screen.getByRole('button', { name: 'Refresh feed' }));
    await waitFor(() => expect(mocks.api['refreshFeed']).toHaveBeenCalled());
  });

  it('lets others report and copy; authors edit and delete', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mocks.api['feed']!.mockResolvedValue({
      items: [makeFeedItem({ id: 'other' }), makeFeedItem({ id: 'mine', authorId: 'u1', authorUsername: 'alice', body: 'Mine' })],
      recommender: 'chronological'
    });
    mocks.api['report']!.mockResolvedValue({});
    mocks.api['editPost']!.mockResolvedValue(makePost({ id: 'mine', authorId: 'u1', body: 'Mine edited', editedAt: '2026-02-02T00:00:00Z' }));
    mocks.api['deletePost']!.mockResolvedValue(undefined);
    renderApp('/feed');
    const cards = await screen.findAllByRole('article');
    const [theirs, mine] = cards as [HTMLElement, HTMLElement];

    await user.click(within(theirs).getByRole('button', { name: 'Post actions' }));
    expect(within(theirs).queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await user.click(within(theirs).getByRole('menuitem', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/thread/other'));
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    await user.click(within(theirs).getByRole('button', { name: 'Post actions' }));
    await user.click(within(theirs).getByRole('menuitem', { name: 'Report' }));
    expect(await screen.findByText('Report received')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    await user.click(within(mine).getByRole('button', { name: 'Post actions' }));
    await user.click(within(mine).getByRole('menuitem', { name: 'Edit' }));
    const box = within(mine).getByLabelText('Edit post');
    await user.clear(box);
    await user.type(box, 'Mine edited');
    await user.click(within(mine).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Mine edited')).toBeInTheDocument();
    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument();

    await user.click(within(screen.getAllByRole('article')[1]!).getByRole('button', { name: 'Post actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Mine edited')).not.toBeInTheDocument());
  });

  it('warns when an edit is blocked', async () => {
    const user = userEvent.setup();
    mocks.api['feed']!.mockResolvedValue({ items: [makeFeedItem({ authorId: 'u1', authorUsername: 'alice' })], recommender: 'x' });
    mocks.api['editPost']!.mockRejectedValue(new ApiError(422, 'content_blocked', 'blocked'));
    renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Post actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Edit not saved')).toBeInTheDocument();
  });
});

describe('threads', () => {
  beforeEach(() => signedIn());

  it('shows a thread with sub-threads and replies', async () => {
    const user = userEvent.setup();
    mocks.api['thread']!.mockResolvedValue({
      items: [makePost({ id: 'r', body: 'Root' }), makePost({ id: 'c', parentId: 'r', body: 'Child' }), makePost({ id: 'g', parentId: 'c', body: 'Grand' })]
    });
    mocks.api['createPost']!.mockResolvedValue(makePost());
    renderApp('/thread/r');
    expect(await screen.findByText('Grand')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Reply to this thread' }), 'A reply');
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await waitFor(() => expect(mocks.api['createPost']).toHaveBeenCalledWith({ body: 'A reply', parentId: 'r', media: [] }));
    await waitFor(() => expect(mocks.api['thread']).toHaveBeenCalledTimes(2));
  });

  it('shows thread errors', async () => {
    mocks.api['thread']!.mockRejectedValue(new Error('Post not found'));
    renderApp('/thread/zzz');
    expect(await screen.findByRole('alert')).toHaveTextContent('Post not found');
  });
});

describe('connections', () => {
  beforeEach(() => signedIn());

  it('shows empty states', async () => {
    renderApp('/connections');
    expect(await screen.findByText('No recommendations yet')).toBeInTheDocument();
    expect(await screen.findByText('No connections yet')).toBeInTheDocument();
  });

  it('connects, accepts, removes and flags drifting profiles', async () => {
    const user = userEvent.setup();
    mocks.api['recommendations']!.mockResolvedValue({
      recommendations: [{ userId: 'u9', username: 'dave', displayName: 'Dave', score: 0.9 }],
      threshold: 0.8
    });
    mocks.api['connections']!.mockResolvedValue({
      connections: [
        { userId: 'u3', username: 'carol', displayName: 'Carol', status: 'pending_incoming', score: null, flag: 'none' },
        { userId: 'u4', username: 'erin', displayName: 'Erin', status: 'accepted', score: 0.5, flag: 'yellow' }
      ]
    });
    mocks.api['connect']!.mockResolvedValue({});
    mocks.api['acceptConnection']!.mockResolvedValue({});
    mocks.api['removeConnection']!.mockResolvedValue(undefined);
    renderApp('/connections');
    expect(await screen.findByText('90% match')).toBeInTheDocument();
    expect(screen.getByText(/Profiles no longer match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Connect with dave' }));
    expect(mocks.api['connect']).toHaveBeenCalledWith('u9');
    await user.click(screen.getByRole('button', { name: 'Accept carol' }));
    expect(mocks.api['acceptConnection']).toHaveBeenCalledWith('u3');
    await user.click(screen.getByRole('button', { name: 'Remove erin' }));
    expect(mocks.api['removeConnection']).toHaveBeenCalledWith('u4');
  });

  it('reports action errors', async () => {
    const user = userEvent.setup();
    mocks.api['recommendations']!.mockResolvedValue({
      recommendations: [{ userId: 'u9', username: 'dave', displayName: 'Dave', score: 0.9 }],
      threshold: 0.8
    });
    mocks.api['connect']!.mockRejectedValue(new Error('A connection or request already exists'));
    renderApp('/connections');
    await user.click(await screen.findByRole('button', { name: 'Connect with dave' }));
    expect(await screen.findByText('A connection or request already exists')).toBeInTheDocument();
  });
});

describe('settings and verification', () => {
  beforeEach(() => signedIn());

  it('saves settings', async () => {
    const user = userEvent.setup();
    mocks.api['updateMe']!.mockResolvedValue({ ...me, displayName: 'Alice B', preferences: { showConnectionPostsInFeed: true, theme: 'dark' } });
    renderApp('/settings');
    const name = await screen.findByLabelText('Display name');
    await user.clear(name);
    await user.type(name, 'Alice B');
    await user.selectOptions(screen.getByLabelText('Who can see my profile'), 'connections');
    await user.click(screen.getByLabelText(/Show a recent-post bubble/));
    await user.click(screen.getByLabelText(/connections' posts in my feed/));
    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    await user.clear(screen.getByLabelText('Country'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(mocks.api['updateMe']).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Alice B',
        country: null,
        interests: ['hiking'],
        privacy: { profileVisibility: 'connections', showRecentBubbles: false },
        preferences: { showConnectionPostsInFeed: true, theme: 'dark' }
      })
    );
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('dark'));
  });

  it('shows save errors', async () => {
    const user = userEvent.setup();
    mocks.api['updateMe']!.mockRejectedValue(new Error('Request validation failed'));
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request validation failed');
  });

  it('deletes the account permanently after confirmation', async () => {
    const user = userEvent.setup();
    mocks.api['deleteMe']!.mockResolvedValue(undefined);
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Confirm with your password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Permanently delete' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(mocks.api['deleteMe']).toHaveBeenCalledWith('correct-horse-battery');
  });

  it('shows delete errors', async () => {
    const user = userEvent.setup();
    mocks.api['deleteMe']!.mockRejectedValue(new Error('Password confirmation failed'));
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Confirm with your password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Permanently delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Password confirmation failed');
  });

  it('submits verification', async () => {
    const user = userEvent.setup();
    mocks.api['submitVerification']!.mockResolvedValue({ id: 'v1', status: 'pending' });
    mocks.api['me']!.mockResolvedValue({ ...me, verificationStatus: 'pending' });
    renderApp('/verify');
    await user.type(await screen.findByLabelText(/Phone/), '+14155550123');
    await user.type(screen.getByLabelText(/Government ID/), 'kyc/id.png');
    await user.type(screen.getByLabelText(/Address proof/), 'kyc/addr.pdf');
    await user.click(screen.getByRole('button', { name: 'Submit for verification' }));
    expect(await screen.findByText(/Submitted/)).toBeInTheDocument();
    expect(await screen.findByText('Verification pending review')).toBeInTheDocument();
  });

  it('shows verification errors', async () => {
    const user = userEvent.setup();
    mocks.api['submitVerification']!.mockRejectedValue(new Error('Use E.164 format'));
    renderApp('/verify');
    await user.type(await screen.findByLabelText(/Phone/), '123');
    await user.type(screen.getByLabelText(/Government ID/), 'a');
    await user.type(screen.getByLabelText(/Address proof/), 'b');
    await user.click(screen.getByRole('button', { name: 'Submit for verification' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E.164');
  });
});

describe('profiles', () => {
  beforeEach(() => signedIn());
  const person = {
    id: 'u2',
    username: 'bob',
    displayName: 'Bob',
    bio: 'Builder',
    country: 'US',
    education: 'BSc',
    profession: 'Dev',
    interests: ['chess'],
    dislikes: [],
    verificationStatus: 'verified' as const,
    createdAt: '2026-01-01T00:00:00Z'
  };

  it('shows a profile, connects and blocks', async () => {
    const user = userEvent.setup();
    mocks.api['profile']!.mockResolvedValue(person);
    mocks.api['connect']!.mockResolvedValue({});
    mocks.api['blockProfile']!.mockResolvedValue(undefined);
    renderApp('/profile/u2');
    expect(await screen.findByText('✓ Verified')).toBeInTheDocument();
    expect(screen.getByText('chess')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Request sent.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Block' }));
    expect(await screen.findByRole('heading', { name: 'Your feed' })).toBeInTheDocument();
  });

  it('hides actions on own profile and shows errors', async () => {
    mocks.api['profile']!.mockResolvedValue({ ...person, id: 'u1', verificationStatus: 'unverified', bio: '', country: null, education: null, profession: null, interests: [] });
    renderApp('/profile/u1');
    await screen.findByText('Not verified');
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('shows profile errors', async () => {
    mocks.api['profile']!.mockRejectedValue(new Error('This profile is only visible to connections'));
    renderApp('/profile/u2');
    expect(await screen.findByRole('alert')).toHaveTextContent('only visible to connections');
  });
});

describe('accessibility (axe)', () => {
  it.each([
    ['/login', false],
    ['/signup', false],
    ['/feed', true],
    ['/connections', true],
    ['/settings', true],
    ['/verify', true]
  ])('%s has no violations', async (route, auth) => {
    if (auth) signedIn();
    mocks.api['feed']!.mockResolvedValue({
      items: [makeFeedItem({ flag: 'yellow', tags: ['fake_news'] }), makeFeedItem({ id: 'p2', flag: 'red' })],
      recommender: 'chronological'
    });
    const { container } = renderApp(route);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
