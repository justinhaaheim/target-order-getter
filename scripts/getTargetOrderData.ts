// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import {playwrightAuthFilePath} from './Auth';
import {authenticateIfNeeded, getNewBrowser} from './Setup';

(async () => {
  // Set auth credentials
  await authenticateIfNeeded();

  // Setup
  const {browser, context, page} = await getNewBrowser({
    browserContextOptions: {storageState: playwrightAuthFilePath},
  });

  // Subscribe to 'request' and 'response' events.
  page.on('request', (request) =>
    console.log('>>', request.method(), request.url()),
  );
  page.on('response', (response) =>
    console.log('<<', response.status(), response.url()),
  );

  await page.goto('https://www.target.com/orders');

  const orderLinksLocator = await page.getByRole('link', {name: 'view order'});

  const firstHref = await orderLinksLocator.first().getAttribute('href');
  console.log('First href:', firstHref);

  const orderLinks = await orderLinksLocator.all();

  const hrefs = await Promise.all(
    orderLinks.map((link) => link.getAttribute('href')),
  );

  console.log('All hrefs:', hrefs);

  // Teardown
  await context.close();
  await browser.close();
})();
