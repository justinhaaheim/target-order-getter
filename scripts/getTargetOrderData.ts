// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import {
  authenticateAndStoreState,
  authFileRelativePath,
  getNewBrowser,
} from './Setup';

(async () => {
  // Set auth credentials
  await authenticateAndStoreState({authFile: authFileRelativePath});

  // Setup
  const {browser, context, page} = await getNewBrowser({
    browserContextOptions: {storageState: authFileRelativePath},
  });

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
