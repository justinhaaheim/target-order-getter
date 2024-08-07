import {expect, test as setup} from '@playwright/test';

/**
 * NOTE: Target is setup with 2fac for normal login, so whether we use that or passkeys
 * we will need user interaction for now. Probably easiest to just run the browser
 * in non-headless mode and sign in with my passkey.
 */

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({page}) => {
  setup.slow();
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
});
