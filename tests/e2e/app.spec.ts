import AxeBuilder from '@axe-core/playwright';
import { expect, test, Page } from '@playwright/test';

const unique = () => Math.random().toString(16).slice(2, 10);

async function signUp(page: Page, username = `e2e${unique()}`) {
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel(/Password/).fill('correct-horse-battery');
  await page.getByLabel('Date of birth').fill('1990-01-01');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible();
  return username;
}

test('anonymous users are sent to log in and pages have no a11y violations', async ({ page }) => {
  await page.goto('/feed');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('sign up, post, thread reply, react and delete account', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Feed' }).first().click();
  await expect(page.getByRole('heading', { name: 'Your feed' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Share something' }).fill('Hello TauSocial');
  await page.getByRole('button', { name: 'Post' }).click();
  const post = page.getByRole('article').filter({ hasText: 'Hello TauSocial' });
  await expect(post).toBeVisible();
  await expect(post.getByText(/Safe/)).toBeVisible();

  await post.getByRole('button', { name: /Thumbs up/ }).click();
  await expect(post.getByRole('button', { name: 'Thumbs up, 1' })).toHaveAttribute('aria-pressed', 'true');

  const feedScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(feedScan.violations).toEqual([]);

  await post.getByRole('link', { name: /Replies|Open thread|thread/i }).first().click();
  await page.getByRole('textbox', { name: 'Reply to this thread' }).fill('First reply');
  await page.getByRole('button', { name: 'Reply' }).click();
  await expect(page.getByText('First reply')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByLabel('Confirm with your password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('invalid login shows an accessible error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel('Password').fill('wrong-password-here');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('unsafe content is blocked with an explanatory popup', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Feed' }).first().click();
  await page.getByRole('textbox', { name: 'Share something' }).fill('I will kill you, you worthless idiot');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('not published');
});

test('mobile layout stays usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/login');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
