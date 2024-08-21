import type {BrowserContext, Page, Response} from 'playwright';

import {RateLimit} from 'async-sema';
import nullthrows from 'nullthrows';

import config from './config';
import {
  TARGET_API_HOSTNAME,
  TARGET_API_ORDER_HISTORY_FULL_URL,
  TARGET_ORDER_PAGE_URL,
} from './Constants';
import {range} from './GeneralUtils';
import {getFetchConfig, getJSONNoThrow} from './Helpers';

const TARGET_RESOURCE_NOT_FOUND_CODE = 102;

export type TargetAPIOrderHistoryItem = {
  [key: string]: unknown;
  order_number: string;
  placed_date: string;
  summary: {grand_total: string};
};

export type TargetAPIInvoiceOverviewItem = {
  [key: string]: unknown;
  date: string;
  id: string;
  type: string;
};

type GetTargetAPIOrderHistoryConfig = {
  // TODO: Support startDate
  orderCount: number;
  page: Page;
};

type ResponseListener = (response: Response) => any;

export function getTargetOrderURL(orderNumber: string): string {
  return `${TARGET_ORDER_PAGE_URL}/${orderNumber}`;
}

export function getTargetOrderInvoicesURL(orderNumber: string): string {
  return `${TARGET_ORDER_PAGE_URL}/${orderNumber}/invoices`;
}

export function getTargetOrderInvoiceURL({
  orderNumber,
  invoiceNumber,
}: {
  invoiceNumber: string;
  orderNumber: string;
}): {path: string; url: string} {
  const path = `/${orderNumber}/invoices/${invoiceNumber}`;
  return {path, url: `${TARGET_ORDER_PAGE_URL}${path}`};
}

export function isTargetOrderHistory(
  data: unknown,
): data is TargetAPIOrderHistoryItem[] {
  if (!Array.isArray(data)) {
    return false;
  }
  return data.every((item) => {
    if (typeof item !== 'object') {
      return false;
    }
    if (typeof item['order_number'] !== 'string') {
      return false;
    }
    if (typeof item['placed_date'] !== 'string') {
      return false;
    }
    if (typeof item['summary'] !== 'object') {
      return false;
    }
    if (typeof item['summary']['grand_total'] !== 'string') {
      return false;
    }
    return true;
  });
}

export function isTargetInvoiceOverviewList(
  data: unknown,
): data is TargetAPIInvoiceOverviewItem[] {
  if (!Array.isArray(data)) {
    return false;
  }
  return data.every((item) => {
    if (typeof item !== 'object') {
      return false;
    }
    if (typeof item['date'] !== 'string') {
      return false;
    }
    if (typeof item['id'] !== 'string') {
      return false;
    }
    if (typeof item['type'] !== 'string') {
      return false;
    }
    return true;
  });
}

/**
 * Order History: The list of a customers orders
 */
export async function getTargetAPIOrderHistoryData({
  orderCount,
  page,
}: GetTargetAPIOrderHistoryConfig): Promise<TargetAPIOrderHistoryItem[]> {
  console.log('[getTargetAPIOrderHistoryData] Order count:', orderCount);

  const {apiURL: apiURLFromInitialRequest, requestInit} = await getFetchConfig({
    browserURL: TARGET_ORDER_PAGE_URL,
    endpointURLToWatch: TARGET_API_ORDER_HISTORY_FULL_URL,
    page,
  });

  const initialPageSize = parseInt(
    nullthrows(apiURLFromInitialRequest.searchParams.get('page_size')),
  );
  const initialPageNumber = parseInt(
    nullthrows(apiURLFromInitialRequest.searchParams.get('page_number')),
  );

  if (initialPageNumber !== 1) {
    throw new Error('pageNumber should be 1 for the first request');
  }

  const pagesRequiredForOrderCount = Math.ceil(orderCount / initialPageSize);
  const pageNumbersToFetch = range(1, pagesRequiredForOrderCount + 1);

  const rateLimiter = RateLimit(config.requestRateLimiter.rps, {
    timeUnit: config.requestRateLimiter.timeUnit, // milliseconds
    uniformDistribution: true,
  });

  const pages = await Promise.all(
    pageNumbersToFetch.map(async (pageNumberToFetch) => {
      // Await the rate limiter until it gives us the green light to go
      await rateLimiter();

      console.log(
        `📡 Fetching page number ${pageNumberToFetch} directly from the API...`,
      );

      const newUrl = new URL(apiURLFromInitialRequest);
      newUrl.searchParams.set('page_number', pageNumberToFetch.toString());

      const newResponse = await fetch(newUrl, requestInit);

      // console.log('New response:', newResponse);
      // console.log('New response JSON:', await newResponse.json());

      const responseJson = (await getJSONNoThrow(newResponse)) as {
        [key: string]: unknown;
        request: {page_number: number; page_size: number};
      };

      if (responseJson == null) {
        console.warn(
          '[getTargetAPIOrderHistoryData] Response JSON is null. This should not happen',
        );
        return;
      }

      const pageNumber = responseJson['request']?.['page_number'];
      const pageSize = responseJson['request']?.['page_size'];
      const ordersArray = responseJson['orders'] as unknown[];

      console.log(
        `Received order_history data for page number ${pageNumber} (page size: ${pageSize})`,
      );

      if (typeof pageNumber !== 'number' || typeof pageSize !== 'number') {
        console.warn('Page number or page size is not a number');
      }

      return ordersArray;
    }),
  );

  const orderData = pages.flat();

  console.log(
    `Order data from API responses (length: ${orderData.length}):`,
    // JSON.stringify(orderData, null, 2),
    orderData,
  );

  // page.off('response', onPageResponse);

  if (!isTargetOrderHistory(orderData)) {
    throw new Error('Order data is not in expected format');
  }

  // NOTE: We will often be fetching more orders than we need, but for clarity let's only return the amount requested
  return orderData.slice(0, orderCount);
}

function isTargetAPIOrderInvoiceOverviewURL(
  response: Response,
  orderNumber: string,
): boolean {
  const url = new URL(response.url());
  if (
    url.host === TARGET_API_HOSTNAME &&
    url.pathname.includes(`orders/${orderNumber}/invoices`)
  ) {
    return true;
  }
  return false;
}

/**
 * Invoice Overview Data: Overview data is just the high level list of invoices, without specific details
 */
export async function getTargetAPIOrderInvoiceOverviewData({
  orderNumber,
  page,
}: {
  orderNumber: string;
  page: Page;
}): Promise<TargetAPIInvoiceOverviewItem[]> {
  // TODO: We can actually get this directly on the order details page. Not entirely sure it shows up on the invoices page (versus being server rendered)
  const invoiceOverviewURL = getTargetOrderInvoicesURL(orderNumber);

  const invoicesOverviewMap = new Map();
  let gotResponseButNoInvoicesAvailable = false;

  const onInvoicesResponse: ResponseListener = async (response: Response) => {
    if (isTargetAPIOrderInvoiceOverviewURL(response, orderNumber)) {
      console.log('INVOICE_OVERVIEW_RESPONSE', response.url());
      const data = (await getJSONNoThrow(response)) as {
        [key: string]: unknown;
        invoices: Array<{[key: string]: unknown}>;
      };
      console.log('Received invoice data:', data);

      if (data == null) {
        console.warn(
          '[getTargetAPIOrderInvoiceOverviewData] Invoice data is null. This should not happen',
        );
        return;
      }

      if (data['code'] === TARGET_RESOURCE_NOT_FOUND_CODE) {
        console.log(
          '[getTargetAPIOrderInvoiceOverviewData] Target API reports resource not found. This can happen when an order was cancelled without any charges/refunds.',
          data,
        );
        gotResponseButNoInvoicesAvailable = true;
        return;
      }

      const invoices = data['invoices'] ?? [];
      invoices.forEach((invoice) => {
        const id = invoice['id'];
        if (id == null) {
          console.warn(
            '[getTargetAPIOrderInvoiceOverviewData] Invoice ID is null. This should not happen',
            invoice,
          );
        }
        invoicesOverviewMap.set(id, invoice);
      });
    }
  };

  // page.on('response', onInvoicesResponse);
  const responsePromise = page.waitForResponse((response) => {
    const isMatchingURL = isTargetAPIOrderInvoiceOverviewURL(
      response,
      orderNumber,
    );
    console.log(
      '[getTargetAPIOrderInvoiceOverviewData] Response received in waitForResponse. Matches?',
      isMatchingURL,
    );
    return isMatchingURL;
  });

  // TODO: Is pagination ever needed for a large number of invoices?
  await page.goto(invoiceOverviewURL);

  await responsePromise;
  await onInvoicesResponse(await responsePromise);

  console.log('OK, weve now awaited the response and can move on.');

  // page.off('response', onInvoicesResponse);

  console.log('About to check if we can return early:', {
    gotResponseButNoInvoicesAvailable,
    invoicesMapSize: invoicesOverviewMap.size,
    invoicesOverviewMap,
  });

  if (invoicesOverviewMap.size === 0 && gotResponseButNoInvoicesAvailable) {
    console.warn(
      '[getTargetAPIOrderInvoiceOverviewData] Target API reports no invoices available.',
    );
    return [];
  }

  // TODO: We probably don't need to wait for this anymore, since all the data we need should come in one api response
  // Wait for at least one invoice link to appear
  // NOTE: `.first()` is needed in strict mode in case this matches more than one link
  await page.getByRole('link', {name: 'View invoice'}).first().waitFor();

  const invoiceOverviewList = Array.from(invoicesOverviewMap.values());

  if (invoiceOverviewList.length === 0) {
    throw new Error('[getTargetAPIOrderInvoiceOverviewData] No invoices found');
  }

  if (!isTargetInvoiceOverviewList(invoiceOverviewList)) {
    throw new Error('Invoice overview data is not in expected format');
  }
  return invoiceOverviewList;
}

/**
 * Individual Invoice Data: The detailed data for a specific invoice
 */
export async function getTargetAPIOrderIndividualInvoiceData({
  orderNumber,
  invoiceNumber,
  page,
}: {
  invoiceNumber: string;
  orderNumber: string;
  page: Page;
}): Promise<unknown> {
  const {url: invoiceURL, path: invoicePath} = getTargetOrderInvoiceURL({
    invoiceNumber,
    orderNumber,
  });

  let invoiceData: unknown = null;

  const onInvoiceResponse: ResponseListener = async (response: Response) => {
    // Target's API mirrors the web navigation structure, so we can just use the path here to identify responses from the invoice API
    const url = new URL(response.url());
    if (
      url.host === TARGET_API_HOSTNAME &&
      url.pathname.includes(invoicePath)
    ) {
      const data = await getJSONNoThrow(response);
      console.log('Received invoice data:', data);

      if (data == null) {
        console.warn(
          '[getTargetAPIOrderIndividualInvoiceData] Invoice data is null. This should not happen',
        );
        return;
      }

      if (invoiceData != null) {
        console.warn(
          '[getTargetAPIOrderIndividualInvoiceData] invoiceData has existing data. Ignoring new data',
          data,
        );
        return;
      }

      invoiceData = data;
    }
  };

  page.on('response', onInvoiceResponse);

  await page.goto(invoiceURL);

  // Wait for the invoice number to be populated in the UI
  await page.getByText(/Invoice number: \d+/i).waitFor();

  page.off('response', onInvoiceResponse);

  if (invoiceData == null) {
    throw new Error(
      '[getTargetAPIOrderIndividualInvoiceData] No invoice data found',
    );
  }

  return invoiceData;
}

/**
 * All Invoice Data: Gets all the invoice data for a given orderNumber
 */
export async function getTargetAPIOrderAllInvoiceData({
  orderNumber,
  page,
}: {
  context: BrowserContext;
  orderNumber: string;
  page: Page;
}): Promise<unknown> {
  console.log('Getting invoice overview data for order:', orderNumber);
  const invoiceOverviewData = await getTargetAPIOrderInvoiceOverviewData({
    orderNumber,
    page,
  });

  const invoiceDataGetters = invoiceOverviewData.map(
    (invoiceOverviewItem) => async (pageForIndividualData: Page) => {
      console.log(
        `Getting individual invoice data for order ${orderNumber} and invoice ${invoiceOverviewItem['id']}...`,
      );
      const data = await getTargetAPIOrderIndividualInvoiceData({
        invoiceNumber: invoiceOverviewItem['id'],
        orderNumber,
        page: pageForIndividualData,
      });

      return data;
    },
  );

  const invoiceData: unknown[] = [];

  // Do the invoices in serial on the same page to avoid anti-blocking measures
  // Keep using the same page for all the individual invoice data
  for (const invoiceDataGetter of invoiceDataGetters) {
    invoiceData.push(await invoiceDataGetter(page));
  }

  return invoiceData;
}
