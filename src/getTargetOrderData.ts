import type {
  CombinedOutputData,
  InvoiceOrderAndAggregationsData,
  OrderHistoryOutputData,
} from './TargetAPITypes';
import type {Request, Response} from 'playwright';

import {Command} from 'commander';
import {v4 as uuidv4} from 'uuid';
import Queue from 'yocto-queue';

import {playwrightAuthContextOptions, playwrightAuthFilePath} from './Auth';
import {TARGET_ORDER_PAGE_URL} from './Constants';
import {CustomRateLimiter} from './CustomRateLimiter';
import {
  getOutputDataFilenamePrefix,
  writeToJSONFileWithDateTime,
} from './Files';
import {actionQueueWrapperFn} from './Helpers';
import projectConfig from './projectConfig';
import {getNewBrowser} from './Setup';
import {
  getTargetAPIOrderAggregationsDataFromAPI,
  getTargetAPIOrderAllInvoiceDataFromAPI,
  getTargetAPIOrderHistoryDataFromAPI,
  getTargetAPIOrderHistoryFetchConfig,
} from './TargetAPIData';
import {
  CombinedOutputDataZod,
  OrderHistoryOutputDataZod,
} from './TargetAPITypes';

type OutputTypes = 'Full' | 'Pruned';

const program = new Command();

program.name('getTargetOrderData');
program
  .requiredOption('-o, --orderCount <number>', 'The number of orders to fetch')
  .option('--skipInvoiceData', 'Skip fetching invoice data');
program.parse();
const cliOptions = program.opts();

// The number of orders to fetch
const orderCount = parseInt(cliOptions['orderCount']);
const skipInvoiceData: boolean = cliOptions['skipInvoiceData'];

const OUTPUT_DIR = 'output';
const ORDER_HISTORY_TYPES_TO_OUTPUT: OutputTypes[] = ['Full', 'Pruned'];
const COMBINED_OUTPUT_TYPES_TO_OUTPUT: OutputTypes[] = ['Full', 'Pruned'];
const TOTAL_OUTPUT_FILE_COUNT =
  ORDER_HISTORY_TYPES_TO_OUTPUT.length + COMBINED_OUTPUT_TYPES_TO_OUTPUT.length;

const TIMEOUT_FOR_INITIAL_AUTHENTICATION = 120 * 1000;

const RETRY_ATTEMPTS_LIMIT = 3;

function shouldLogRequestResponse(urlString: string) {
  const url = new URL(urlString);

  if (url.hostname.includes('api.target.com')) {
    return true;
  }

  if (!url.hostname.includes('target.com')) {
    return false;
  }

  if (url.hostname.includes('assets') || url.hostname.includes('scene7.com')) {
    return false;
  }

  if (url.hostname.includes('redsky') || url.hostname.includes('redoak')) {
    return false;
  }

  return true;
}

export type ActionQueueItem<T> = {
  action: () => Promise<T>;
  attemptsLimit: number;
  attemptsMade: number;
  id: string;
};

// const DEV_ONLY_ORDER_LIMIT = 5;

(async () => {
  // TODO: Target keeps making us login, so let's just authenticate on the same page/context/browser we'll be browsing in rather than recreating it
  // Set auth credentials
  // await authenticateIfNeeded();

  console.log('');

  // Setup
  const {
    browser,
    context,
    page: mainPage,
  } = await getNewBrowser({
    browserContextOptions: playwrightAuthContextOptions,
  });

  const rateLimiter = CustomRateLimiter(projectConfig.requestRateLimiter.rps, {
    timeUnit: projectConfig.requestRateLimiter.timeUnit, // milliseconds
    uniformDistribution: true,
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

  // await mainPage.waitForTimeout(50 * 1000);

  /**
   * Get the order history data
   */
  const fetchConfig = await getTargetAPIOrderHistoryFetchConfig({
    page: mainPage,
  });

  console.log('\n\n📋 Getting order history data...');
  const orderHistoryData = await getTargetAPIOrderHistoryDataFromAPI({
    fetchConfigFromInitialOrderHistoryRequest: fetchConfig,
    orderCount,
    page: mainPage,
    rateLimiter,
  });

  /**
   * Output the order history data to a file before proceeding in case the remainder fails
   */
  const outputTimestamp = new Date();
  let fileOutputNumber = 1;

  ORDER_HISTORY_TYPES_TO_OUTPUT.forEach((outputType) => {
    const outputDataOrderHistoryFull: OrderHistoryOutputData = {
      _createdTimestamp: outputTimestamp.valueOf(),
      _params: {orderCount},
      orderHistoryData: orderHistoryData,
    };

    let outputDataOrderHistory = outputDataOrderHistoryFull;

    if (outputType === 'Pruned') {
      const parseResult = OrderHistoryOutputDataZod.safeParse(
        outputDataOrderHistoryFull,
      );

      if (!parseResult.success) {
        console.error(
          'Failed to prune order history data before writing to file. Skipping.',
          parseResult.error,
        );
        return;
      } else {
        outputDataOrderHistory = parseResult.data;
      }
    }

    writeToJSONFileWithDateTime({
      basePath: OUTPUT_DIR,
      data: outputDataOrderHistory,
      name: getOutputDataFilenamePrefix({
        dataType: `orderHistoryData${outputType}`,
        fileNumber: fileOutputNumber,
        params: `${orderCount}-orders`,
        totalFiles: TOTAL_OUTPUT_FILE_COUNT,
      }),
      timestamp: outputTimestamp,
    });

    fileOutputNumber += 1;
  });

  if (!skipInvoiceData && orderHistoryData.length > 0) {
    console.log('\n\n📋 Getting invoice data...');
    // /**
    //  * Get all invoice data for each order
    //  */

    // const orderInvoicePromises = orderHistoryData.map((order, index) => {

    // })

    /**
     * OLD: Get all invoice data for each order
     */
    const orderInvoiceActionQueue: Array<
      ActionQueueItem<InvoiceOrderAndAggregationsData>
    > = orderHistoryData.map((order, index) => ({
      action: async (): Promise<InvoiceOrderAndAggregationsData> => {
        // TODO: pass the rate limiter into each one of these functions, and call it before any API query so that we're rate limiting the query calls themselves.
        await rateLimiter();
        console.log(
          `Getting all order invoice data for order ${order['order_number']}...`,
        );
        const invoicesData = await getTargetAPIOrderAllInvoiceDataFromAPI({
          fetchConfig,
          orderNumber: order['order_number'],
        });

        const orderAggregationsData =
          await getTargetAPIOrderAggregationsDataFromAPI({
            fetchConfig,
            orderNumber: order['order_number'],
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
          orderAggregationsData: orderAggregationsData,
          orderHistoryData: order,
        };
      },
      attemptsLimit: RETRY_ATTEMPTS_LIMIT,
      attemptsMade: 0,
      id: `${
        order['order_number'] ?? `NO_ORDER_NUMBER-${uuidv4()}`
      }-${index}-invoiceAction`,
    }));

    const combinedOrderData: Array<InvoiceOrderAndAggregationsData> = [];
    // let actionRunCount = 0;

    const actionQueueCompletePromiseFunctions: {
      reject: ((reason?: any) => void) | null;
      resolve: ((value: PromiseLike<void> | void) => void) | null;
    } = {reject: null, resolve: null};
    const actionQueueCompletePromise = new Promise<void>((resolve, reject) => {
      actionQueueCompletePromiseFunctions.resolve = resolve;
      actionQueueCompletePromiseFunctions.reject = reject;
    });

    const actionQueue = new Queue<() => Promise<void>>();

    const kickoffNextAction = async () => {
      console.debug(
        `[Queue size: ${actionQueue.size}] Kicking off next action...`,
      );
      const a = actionQueue.dequeue();
      if (a != null) {
        a();
      } else {
        if (actionQueueCompletePromiseFunctions.resolve == null) {
          throw new Error(
            'actionQueueCompletePromiseFunctions.resolve is null. it should not be',
          );
        }
        console.debug(
          'No more actions to kick off. Resolving the actionQueueCompletePromise',
        );
        actionQueueCompletePromiseFunctions.resolve();
      }
    };

    orderInvoiceActionQueue.forEach((action) => {
      actionQueue.enqueue(() =>
        actionQueueWrapperFn({
          action,
          combinedOrderData,
          kickoffNextAction,
          queue: actionQueue,
        }),
      );
    });

    kickoffNextAction();

    await actionQueueCompletePromise;

    /**
     * Output the combined order data to a file
     */
    COMBINED_OUTPUT_TYPES_TO_OUTPUT.forEach((outputType) => {
      const combinedOutputDataFull: CombinedOutputData = {
        _createdTimestamp: outputTimestamp.valueOf(),
        _params: {orderCount},
        invoiceAndOrderData: combinedOrderData,
      };

      let combinedOutputData = combinedOutputDataFull;

      if (outputType === 'Pruned') {
        const parseResult = CombinedOutputDataZod.safeParse(
          combinedOutputDataFull,
        );

        if (!parseResult.success) {
          console.error(
            'Failed to prune combined order and invoice data before writing to file. Skipping.',
            parseResult.error,
          );
          return;
        } else {
          combinedOutputData = parseResult.data;
        }
      }

      writeToJSONFileWithDateTime({
        basePath: 'output/',
        data: combinedOutputData,
        name: getOutputDataFilenamePrefix({
          dataType: `invoiceAndOrderData${outputType}`,
          fileNumber: fileOutputNumber,
          params: `${orderCount}-orders`,
          totalFiles: TOTAL_OUTPUT_FILE_COUNT,
        }),
        timestamp: outputTimestamp,
      });

      fileOutputNumber += 1;
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
