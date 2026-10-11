import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn()
}));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot
}));

describe('web entry point', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.render.mockReset();
    mocks.createRoot.mockReset().mockReturnValue({ render: mocks.render });
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('mounts the application in the root element', async () => {
    await import('./main');

    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mocks.render).toHaveBeenCalledOnce();
  });
});
