import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeFileSync: vi.fn(),
  log: vi.fn()
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  writeFileSync: mocks.writeFileSync
}));

describe('OpenAPI export script', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the generated contract and reports its destination', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(mocks.log);
    await import('./export-openapi');

    expect(mocks.writeFileSync).toHaveBeenCalledOnce();
    const [target, contents] = mocks.writeFileSync.mock.calls[0] as [string, string];
    expect(target).toMatch(/docs\/openapi\.json$/);
    expect(contents.endsWith('\n')).toBe(true);
    expect(JSON.parse(contents).info.title).toBe('TauSocial API');
    expect(log).toHaveBeenCalledWith(`Wrote ${target}`);
  });
});
