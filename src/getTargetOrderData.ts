// import assert from 'node:assert';
// import {chromium, devices} from 'playwright';

import type {Page, Request, Response} from 'playwright';

import {Command} from 'commander';
import {mkdirSync} from 'fs';
import {v4 as uuidv4} from 'uuid';

import {playwrightAuthContextOptions, playwrightAuthFilePath} from './Auth';
import {TARGET_ORDER_PAGE_URL} from './Constants';
import {
  getOutputDataFilenamePrefix,
  writeToJSONFileWithDateTime,
} from './Files';
import {getNewBrowser} from './Setup';
import {
  getTargetAPIOrderAllInvoiceData,
  getTargetAPIOrderHistoryData,
} from './TargetAPIData';

const program = new Command();

program.name('getTargetOrderData');
program.requiredOption(
  '-o, --orderCount <number>',
  'The number of orders to fetch',
);
program.parse();
const cliOptions = program.opts();

// The number of orders to fetch
const orderCount = parseInt(cliOptions['orderCount']);

const OUTPUT_DIR = 'output';

const TIMEOUT_BETWEEN_ORDERS_MS = 0.5 * 1000;

const TIMEOUT_FOR_INITIAL_AUTHENTICATION = 120 * 1000;

const GET_INVOICE_DATA = false;

const RETRY_ATTEMPTS_LIMIT = 3;

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

type OutputData = {
  [key: string]: unknown;
  _createdTimestamp: number;
  _params: {
    orderCount: number;
  };
};

// const DEV_ONLY_ORDER_LIMIT = 5;

(async () => {
  // TODO: Target keeps making us login, so let's just authenticate on the same page/context/browser we'll be browsing in rather than recreating it
  // Set auth credentials
  // await authenticateIfNeeded();

  console.log('\n');

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

  // Try navigating to the target order page. If we need to authenticate we'll have a timeout in which to complete that, after which we should be redirected to the order page
  await mainPage.goto(TARGET_ORDER_PAGE_URL);
  await mainPage.waitForURL(`${TARGET_ORDER_PAGE_URL}**`, {
    timeout: TIMEOUT_FOR_INITIAL_AUTHENTICATION,
  });

  /**
   * Get the order history data
   */

  console.log('\n\n📋 Getting order history data...');
  const orderHistoryData = await getTargetAPIOrderHistoryData({
    orderCount,
    page: mainPage,
  });

  /**
   * Output the order history data to a file before proceeding in case the remainder fails
   */
  const outputTimestamp = new Date();

  // Create the dir if it doesn't exist
  mkdirSync(OUTPUT_DIR, {recursive: true});

  const outputDataOrderHistory: OutputData = {
    _createdTimestamp: outputTimestamp.valueOf(),
    _params: {orderCount},
    orderHistoryData: orderHistoryData,
  };

  writeToJSONFileWithDateTime({
    basePath: OUTPUT_DIR,
    data: outputDataOrderHistory,
    name: getOutputDataFilenamePrefix({
      dataType: 'orderHistoryData',
      fileNumber: 1,
      totalFiles: 2,
    }),
    timestamp: outputTimestamp,
  });

  if (GET_INVOICE_DATA) {
    console.log('\n\n📋 Getting invoice data...');
    /**
     * Get all invoice data for each order
     */
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
                : new Date(orderDateString).valueOf(),
            _orderNumber: order['order_number'],
            invoicesData: invoicesData,
            orderHistoryData: order,
          };
        },
        attemptsLimit: RETRY_ATTEMPTS_LIMIT,
        attemptsMade: 0,
        id: `${
          order['order_number'] ?? `NO_ORDER_NUMBER-${uuidv4()}`
        }-${index}-invoiceAction`,
      }),
    );

    const combinedOrderData: Array<unknown> = [];
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
        combinedOrderData.push(orderData);
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

    /**
     * Output the combined order data to a file
     */
    const combinedOutputData = {
      _createdTimestamp: outputTimestamp.valueOf(),
      _params: {orderCount},
      invoiceAndOrderData: combinedOrderData,
    };

    writeToJSONFileWithDateTime({
      basePath: 'output/',
      data: combinedOutputData,
      name: getOutputDataFilenamePrefix({
        dataType: 'invoiceAndOrderData',
        fileNumber: 2,
        totalFiles: 2,
      }),
      timestamp: outputTimestamp,
    });
  } else {
    console.log('Skipping invoice data...');
  }

  console.log('\n\nDoing final timeout before closing browser context...');
  await mainPage.waitForTimeout(30 * 1000);
  console.log('Closing browser context...');

  // Save the cookies to the auth file, assuming that's better than resetting from a previous state
  console.log('Saving browser state to auth file...');
  await mainPage.context().storageState({
    path: playwrightAuthFilePath,
  });

  // Teardown
  await context.close();
  await browser.close();
})();
