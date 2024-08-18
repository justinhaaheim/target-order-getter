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

  const orderResponsePages: Array<Array<unknown>> = [];

  // Subscribe to 'request' and 'response' events.
  page.on('request', (request) =>
    console.log('>>', request.method(), request.url()),
  );
  page.on('response', async (response) => {
    console.log('<<', response.status(), response.url());

    if (response.url().includes('order_history')) {
      // console.log('Order history response:', response);
      const responseJson = await response.json();
      // console.log('Order history response JSON:', responseJson);

      const pageNumber = responseJson['request']?.['page_number'];
      const pageSize = responseJson['request']?.['page_size'];
      const ordersArray = responseJson['orders'];

      if (typeof pageNumber !== 'number' || typeof pageSize !== 'number') {
        throw new Error('Page number or page size is not a number');
      }

      console.log(
        `Received order data for page number ${pageNumber} (page size: ${pageSize})`,
      );

      if (orderResponsePages[pageNumber] != null) {
        console.log(
          `Overwriting existing order data for page number ${pageNumber}`,
          {
            orderLinks,
            pageNumber,
            pageSize,
          },
        );
      }
      orderResponsePages[pageNumber] = ordersArray;
    }
  });

  await page.goto(TARGET_ORDER_PAGE_URL);

  const orderLinksLocator = await page.getByRole('link', {name: 'view order'});
  console.log('View order links now present.');

  const firstHref = await orderLinksLocator.first().getAttribute('href');
  console.log('First href:', firstHref);

  const orderLinks = await orderLinksLocator.all();

  const hrefs = await Promise.all(
    orderLinks.map((link) => link.getAttribute('href')),
  );

  console.log('All hrefs:', hrefs);

  // Load more orders
  await loadMoreOrdersUntilOrderCount({orderCount: 35, page});

  const orderData = orderResponsePages.flat();

  console.log(
    `Order data from API responses (length: ${orderData.length}:`,
    // JSON.stringify(orderData, null, 2),
    orderData,
  );

  // Teardown
  await context.close();
  await browser.close();
})();
