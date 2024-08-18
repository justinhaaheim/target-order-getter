// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import {mkdirSync} from 'fs';

import {playwrightAuthContextOptions} from './Auth';
import {writeToJSONFileWithDateTime} from './Files';
import {authenticateIfNeeded, getNewBrowser} from './Setup';
import {
  getTargetAPIOrderAllInvoiceData,
  getTargetAPIOrderHistoryData,
} from './TargetAPIData';

const OUTPUT_DIR = 'output';

const TIMEOUT_BETWEEN_ORDERS_MS = 30 * 1000;

const DEV_ONLY_ORDER_LIMIT = 3;

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

  const orderCount = 20;

  console.log('📋 Getting order history data...');
  const orderHistoryData = await getTargetAPIOrderHistoryData({
    orderCount,
    page,
  });

  const orderInvoiceDataGetters = orderHistoryData.map((order) => async () => {
    console.log(`Creating a new page for order ${order['order_number']}...`);
    const newPage = await browser.newPage();
    console.log('Getting all order invoice data...');
    const invoicesData = await getTargetAPIOrderAllInvoiceData({
      context,
      orderNumber: order['order_number'],
      page: newPage,
    });

    newPage.close();

    const orderDateString = order['placed_date'];

    return {
      _orderDate:
        orderDateString == null || orderDateString.length === 0
          ? null
          : new Date(orderDateString),
      _orderNumber: order['order_number'],
      invoicesData: invoicesData,
      orderHistoryData: order,
    };
  });

  const allOrderData: Array<unknown> = [];

  console.log('📋 Getting order invoice data for each order...');
  // Do these one at a time for now
  for (const orderInvoiceDataGetter of orderInvoiceDataGetters.slice(
    0,
    DEV_ONLY_ORDER_LIMIT,
  )) {
    console.log(`Getting order invoice data...`);
    const orderData = await orderInvoiceDataGetter();
    console.log(
      `Got order invoice data for order ${
        orderData?.orderHistoryData?.order_number ?? 'NO_ORDER_NUMBER'
      }...`,
    );
    allOrderData.push(orderData);
    await page.waitForTimeout(TIMEOUT_BETWEEN_ORDERS_MS);
  }

  // Create the dir if it doesn't exist
  mkdirSync(OUTPUT_DIR, {recursive: true});

  writeToJSONFileWithDateTime({
    basePath: 'output/',
    data: allOrderData,
    name: `targetOrderInvoiceData-${orderCount}-orders`,
  });

  console.log('Doing final timeout before closing browser context...');
  await page.waitForTimeout(30 * 1000);
  console.log('Closing browser context...');

  // Teardown
  await context.close();
  await browser.close();
})();
