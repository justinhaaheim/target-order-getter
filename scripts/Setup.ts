import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from 'playwright';

import {chromium, devices} from 'playwright';

import {getIsAuthFileCookieStillValid, playwrightAuthFilePath} from './Auth';

export async function authenticateIfNeeded(): Promise<void> {
  console.log('🔍 Checking if auth file is still valid...');

  const isAuthCookieValid = await getIsAuthFileCookieStillValid(
    playwrightAuthFilePath,
  );

  if (isAuthCookieValid) {
    console.log('✅ Auth file is still valid.');
    return;
  }
  console.log('🚫 Auth file is expired. Re-authenticating...');
  await authenticateAndStoreState({authFile: playwrightAuthFilePath});

  // Let's check again:

  const isValidAfterReauthentication = await getIsAuthFileCookieStillValid(
    playwrightAuthFilePath,
  );

  if (!isValidAfterReauthentication) {
    throw new Error(
      '🚫 Auth file is still expired after re-authentication. This should not happen. Exiting.',
    );
  } else {
    console.log('✅ Auth file has been updated.');
  }
}

export async function authenticateAndStoreState({
  authFile,
}: {
  authFile: string;
}) {
  // Setup
  const {page} = await getNewBrowser({});

  // await page.goto(ONE_PASSWORD_CHROME_EXTENSION_URL);

  // await page.waitForTimeout(60 * 1000);

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

  await page.context().storageState({
    path: authFile,
  });
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

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false, // For branded chrome browser
  });
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    ...browserContextOptions,
  });
  const page = await context.newPage();

  return {browser, context, page};
}
