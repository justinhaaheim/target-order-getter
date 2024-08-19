// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import type {Page, Request, Response} from 'playwright';

import {mkdirSync} from 'fs';
import {v4 as uuidv4} from 'uuid';

import {playwrightAuthContextOptions} from './Auth';
import {writeToJSONFileWithDateTime} from './Files';
import {getNewBrowser} from './Setup';
import {
  getTargetAPIOrderAllInvoiceData,
  getTargetAPIOrderHistoryData,
} from './TargetAPIData';

const OUTPUT_DIR = 'output';

const TIMEOUT_BETWEEN_ORDERS_MS = 0.5 * 1000;

function shouldLogRequestResponse(urlString: string) {
  const url = new URL(urlString);

  if (url.hostname.includes('api.target.com')) {
    return true;
  }

  if (url.hostname.includes('assets')) {
    return false;
  }

  if (url.hostname.includes('redsky') || url.hostname.includes('redoak')) {
    return false;
  }

  return true;
}

type ActionQueueItem = {
  action: ({page}: {page: Page}) => Promise<any>;
  attemptsLimit: number;
  attemptsMade: number;
  id: string;
};

// const DEV_ONLY_ORDER_LIMIT = 5;

(async () => {
  // TODO: Target keeps making us login, so let's just authenticate on the same page/context/browser we'll be browsing in rather than recreating it
  // Set auth credentials
  // await authenticateIfNeeded();

  // Setup
  const {
    browser,
    context,
    page: mainPage,
  } = await getNewBrowser({
    browserContextOptions: playwrightAuthContextOptions,
  });

  // Subscribe to 'request' and 'response' events.
  mainPage.on(
    'request',
    (request: Request) =>
      shouldLogRequestResponse(request.url()) &&
      console.debug('>>', request.method(), request.url()),
  );
  mainPage.on(
    'response',
    (response: Response) =>
      shouldLogRequestResponse(response.url()) &&
      console.debug('<<', response.status(), response.url()),
  );

  const orderCount = 20;

  console.log('📋 Getting order history data...');
  const orderHistoryData = await getTargetAPIOrderHistoryData({
    orderCount,
    page: mainPage,
  });

  const orderInvoiceActionQueue: ActionQueueItem[] = orderHistoryData.map(
    (order, index) => ({
      action: async ({page: pageForAllInvoiceData}) => {
        console.log(
          `Creating a new page for order ${order['order_number']}...`,
        );
        // const newPage = await browser.newPage();
        console.log('Getting all order invoice data...');
        const invoicesData = await getTargetAPIOrderAllInvoiceData({
          context,
          orderNumber: order['order_number'],
          page: pageForAllInvoiceData,
        });

        console.log(
          `Got order invoice data for order ${
            order['order_number'] ?? 'NO_ORDER_NUMBER'
          }...`,
        );

        // newPage.close();

        const orderDateString = order['placed_date'];

        return {
          __orderIndex: index,
          _orderDate:
            orderDateString == null || orderDateString.length === 0
              ? null
              : new Date(orderDateString),
          _orderNumber: order['order_number'],
          invoicesData: invoicesData,
          orderHistoryData: order,
        };
      },
      attemptsLimit: 3,
      attemptsMade: 0,
      id: `${
        order['order_number'] ?? `NO_ORDER_NUMBER-${uuidv4()}`
      }-${index}-invoiceAction`,
    }),
  );

  const allOrderData: Array<unknown> = [];
  let actionRunCount = 0;

  console.log('📋 Beginning to process action queue...');
  while (orderInvoiceActionQueue.length > 0) {
    const currentAction = orderInvoiceActionQueue.shift();
    if (currentAction == null) {
      break;
    }

    if (currentAction.attemptsMade >= currentAction.attemptsLimit) {
      console.log(
        `Action ${currentAction.id} has already made ${currentAction.attemptsMade}/${currentAction.attemptsLimit} attempts. Skipping.`,
      );
      continue;
    }

    try {
      if (actionRunCount > 0) {
        await mainPage.waitForTimeout(TIMEOUT_BETWEEN_ORDERS_MS);
      }
      actionRunCount += 1;

      console.log(
        `🟢 Initiating action ${currentAction.id} (attempt ${
          currentAction.attemptsMade + 1
        }/${currentAction.attemptsLimit})...`,
      );
      const orderData = await currentAction.action({page: mainPage});
      console.debug(`Action ${currentAction.id} completed successfully.`);
      allOrderData.push(orderData);
      console.debug(`Action ${currentAction.id} data pushed.`);
    } catch (error) {
      console.warn(`Action ${currentAction.id} threw the following error:`);
      console.warn(error);

      if (currentAction.attemptsMade + 1 < currentAction.attemptsLimit) {
        // Queue the action to retry right away. Running these actions in their original order may have some advantages in terms of clarity.
        console.debug(`Re-queuing action ${currentAction.id}...`);
        orderInvoiceActionQueue.unshift({
          ...currentAction,
          attemptsMade: currentAction.attemptsMade + 1,
        });
      }
    }
  } // END WHILE

  // Create the dir if it doesn't exist
  mkdirSync(OUTPUT_DIR, {recursive: true});

  const outputData = {
    _createdTimestamp: new Date(),
    _params: {orderCount},
    invoiceAndOrderData: allOrderData,
    orderHistoryData,
  };

  writeToJSONFileWithDateTime({
    basePath: 'output/',
    data: outputData,
    name: `targetOrderInvoiceData-${orderCount}-orders`,
  });

  console.log('Doing final timeout before closing browser context...');
  await mainPage.waitForTimeout(30 * 1000);
  console.log('Closing browser context...');

  // Teardown
  await context.close();
  await browser.close();
})();
