import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from 'playwright';

import {chromium, devices} from 'playwright';

export const authFileRelativePath = 'playwright/.auth/user.json';

export async function authenticateAndStoreState({
  authFile,
}: {
  authFile: string;
}) {
  // Setup
  const {browser, context, page} = await getNewBrowser({});

  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://www.target.com/orders');

  // await page.getByLabel('Username or email address').fill('username');
  // await page.getByLabel('Password').fill('password');
  await page.getByRole('button', {name: 'Use a passkey'}).click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL('https://www.target.com/orders**');

  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  // await expect(page.getByRole('button', {name: 'Hi, Justin'})).toBeVisible({
  //   timeout: 25000,
  // });

  // End of authentication steps.

  await page.context().storageState({path: authFile});
}

type GetNewBrowserProps = {
  browserContextOptions?: BrowserContextOptions;
};

export async function getNewBrowser(props: GetNewBrowserProps): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const {browserContextOptions} = props ?? {};

  const browser = await chromium.launch({headless: false});
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    ...browserContextOptions,
  });
  const page = await context.newPage();

  return {browser, context, page};
}
