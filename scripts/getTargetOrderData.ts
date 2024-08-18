// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import {playwrightAuthContextOptions} from './Auth';
import {TARGET_ORDER_PAGE_URL} from './Constants';
import {loadMoreOrdersUntilOrderCount} from './Helpers';
import {authenticateIfNeeded, getNewBrowser} from './Setup';

(async () => {
  // Set auth credentials
  await authenticateIfNeeded();

  // Setup
  const {browser, context, page} = await getNewBrowser({
    browserContextOptions: playwrightAuthContextOptions,
  });

  // Subscribe to 'request' and 'response' events.
  page.on('request', (request) =>
    console.log('>>', request.method(), request.url()),
  );
  page.on('response', (response) => {
    console.log('<<', response.status(), response.url());
  });

  const orderHistoryData = await getTargetAPIOrderHistoryData({
    orderCount: 30,
    page,
  });

  // Teardown
  await context.close();
  await browser.close();
})();
