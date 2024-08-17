import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from 'playwright';

import {chromium, devices} from 'playwright';

import {
  getIsAuthFileCookieStillValid,
  playwrightAuthContextOptions,
  playwrightAuthFilePath,
} from './Auth';

// Should only be viewable when logged in
const TARGET_ORDER_PAGE_URL = 'https://www.target.com/orders';

type GetNewBrowserConfig = {
  browserContextOptions?: BrowserContextOptions;
};

export async function canNavigateToURL(
  url: string,
  config: GetNewBrowserConfig = {},
): Promise<boolean> {
  const {browser, context, page} = await getNewBrowser(config);

  await page.goto(url);

  let canNavigateToURL = false;
  const currentUrl = page.url();

  // TODO: We probably want something less brittle/more robust here than just the simple startsWith check.
  if (currentUrl.startsWith(url)) {
    canNavigateToURL = true;
    console.log(`✅ Successfully navigated to: ${currentUrl}`, {
      currentUrl,
      url,
    });
  } else {
    console.warn('🚫 Failed to navigate to url', {currentUrl, url});
  }

  await context.close();
  await browser.close();

  return canNavigateToURL;
}

export async function authenticateIfNeeded(): Promise<void> {
  console.log('🔍 Checking if auth file is still valid...');

  const isAuthCookieValid = await getIsAuthFileCookieStillValid(
    playwrightAuthFilePath,
  );

  if (isAuthCookieValid) {
    console.log('✅ Auth file is still valid.');

    const canNavigate = await canNavigateToURL(TARGET_ORDER_PAGE_URL, {
      browserContextOptions: playwrightAuthContextOptions,
    });

    if (canNavigate) {
      console.log('✅ Successfully navigated to:', TARGET_ORDER_PAGE_URL);
      return;
    }
    console.warn(
      `🚫 Failed to navigate to ${TARGET_ORDER_PAGE_URL} even though auth cookies appear to be valid. Attempting to reauthenticate...`,
    );
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

export async function getNewBrowser(config: GetNewBrowserConfig): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const {browserContextOptions} = config ?? {};

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
