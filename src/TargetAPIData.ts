import type {RateLimiterFunction} from './CustomRateLimiter';
import type {FetchConfigWithResponse} from './Helpers';
import type {
  InvoiceDetail,
  TargetAPIInvoiceOverviewObjectArray,
  TargetAPIOrderAggregationsData,
  TargetAPIOrderHistoryObjectArray,
} from './TargetAPITypes';
import type {Page, Response} from 'playwright';

import nullthrows from 'nullthrows';

import {
  TARGET_API_HOSTNAME,
  TARGET_API_ORDER_HISTORY_FULL_URL,
  TARGET_ORDER_PAGE_URL,
} from './Constants';
import {range} from './GeneralUtils';
import {getFetchConfig, getJSONNoThrow, isJsObject} from './Helpers';
import isNonNullable from './isNonNullable';
import {
  InvoiceDetailZod,
  TargetAPIInvoiceOverviewObjectArrayZod,
  TargetAPIOrderAggregationsDataZod,
  TargetAPIOrderHistoryObjectArrayZod,
} from './TargetAPITypes';

const TARGET_RESOURCE_NOT_FOUND_CODE = 102;

// export type TargetAPIOrderHistoryItem = {
//   [key: string]: unknown;
//   order_number: string;
//   placed_date: string;
//   summary: {grand_total: string};
// };

type GetTargetAPIOrderHistoryConfig = {
  // TODO: Support startDate
  fetchConfigFromInitialOrderHistoryRequest: FetchConfigWithResponse;
  orderCount: number;
  page: Page;
  rateLimiter: RateLimiterFunction;
};

type ResponseListener = (response: Response) => any;

export function getTargetOrderBrowserURL(orderNumber: string): string {
  return `${TARGET_ORDER_PAGE_URL}/${orderNumber}`;
}

export function getTargetOrderInvoiceOverviewBrowserURL(
  orderNumber: string,
): string {
  return `${TARGET_ORDER_PAGE_URL}/${orderNumber}/invoices`;
}

export function getTargetOrderInvoiceBrowserURL({
  orderNumber,
  invoiceNumber,
}: {
  invoiceNumber: string;
  orderNumber: string;
}): {path: string; url: string} {
  const path = `/${orderNumber}/invoices/${invoiceNumber}`;
  return {path, url: `${TARGET_ORDER_PAGE_URL}${path}`};
}

function getTargetAPIInvoiceOverviewEndpointURL(orderNumber: string): string {
  return `https://${TARGET_API_HOSTNAME}/post_order_invoices/v1/orders/${orderNumber}/invoices`;
}

function getTargetAPIInvoiceEndpointURL({
  orderNumber,
  invoiceNumber,
}: {
  invoiceNumber: string;
  orderNumber: string;
}): string {
  return `https://${TARGET_API_HOSTNAME}/post_order_invoices/v1/orders/${orderNumber}/invoices/${invoiceNumber}`;
}

function getTargetAPIOrderAggregationsEndpointURL(orderNumber: string): string {
  return `https://${TARGET_API_HOSTNAME}/guest_order_aggregations/v1/${orderNumber}?pending_order=true&shipt_status=true`;
}

export async function getTargetAPIOrderHistoryFetchConfig({
  page,
}: {
  page: Page;
}): Promise<FetchConfigWithResponse> {
  return await getFetchConfig({
    browserURL: TARGET_ORDER_PAGE_URL,
    endpointURLToWatch: TARGET_API_ORDER_HISTORY_FULL_URL,
    page,
  });
}

/**
 * Order History: The list of a customers orders
 */
export async function getTargetAPIOrderHistoryDataFromAPI({
  orderCount,
  rateLimiter,
  fetchConfigFromInitialOrderHistoryRequest,
}: GetTargetAPIOrderHistoryConfig): Promise<TargetAPIOrderHistoryObjectArray> {
  console.log('[getTargetAPIOrderHistoryData] Order count:', orderCount);

  const {apiURL: apiURLFromInitialRequest, requestInit} =
    fetchConfigFromInitialOrderHistoryRequest;

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
        // TODO: Figure out what should actually happen here
        return [];
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

  // Throws if the data is not in the expected format
  // Because our type has a union with Record<string, unknown>, any keys we haven't specifically typed will still pass through
  const parseResult = TargetAPIOrderHistoryObjectArrayZod.safeParse(orderData);

  if (!parseResult.success) {
    console.error(
      `[getTargetAPIOrderHistoryDataFromAPI] Server response doesn't match expected schema. We'll try to recover anyway.`,
      parseResult.error,
    );
  } else {
    console.log('✅ Order history data successfully parsed/validated');
  }

  // We know that this may contain keys that are not in our schema, but we'll strip those out later
  const orderDataTyped = orderData as TargetAPIOrderHistoryObjectArray;

  // NOTE: We will often be fetching more orders than we need, but for clarity let's only return the amount requested
  return orderDataTyped.slice(0, orderCount);
}

/**
 * Invoice Overview Data: Overview data is just the high level list of invoices, without specific details
 */
export async function getTargetAPIOrderInvoiceOverviewDataFromAPI({
  orderNumber,
  fetchConfig,
}: {
  fetchConfig: FetchConfigWithResponse;
  orderNumber: string;
}): Promise<TargetAPIInvoiceOverviewObjectArray | null> {
  // FYI: We can actually get this directly on the order details page. Not entirely sure it shows up on the invoices page (versus being server rendered)

  const apiResponse = await fetch(
    getTargetAPIInvoiceOverviewEndpointURL(orderNumber),
    {
      ...fetchConfig.requestInit,
      referrer: getTargetOrderInvoiceOverviewBrowserURL(orderNumber),
    },
  );

  const responseJson = await getJSONNoThrow(apiResponse);

  if (!isJsObject(responseJson)) {
    const message =
      '[getTargetAPIOrderInvoiceOverviewDataFromAPI] responseJson is not an object. This should not happen';
    console.warn(message, {responseJson});
    throw new Error(message);
  }

  if (
    'code' in responseJson &&
    responseJson['code'] === TARGET_RESOURCE_NOT_FOUND_CODE
  ) {
    console.log(
      '[getTargetAPIOrderInvoiceOverviewDataFromAPI] Target API reports resource not found. This can happen when an order was cancelled without any charges/refunds, or when an order is still processing.',
      responseJson,
    );
    return null;
  }

  if (!('invoices' in responseJson)) {
    throw new Error(
      '[getTargetAPIOrderInvoiceOverviewDataFromAPI] Invoice overview API returned no invoices. This should not happen.',
    );
  }

  const invoicesFromResponse = responseJson['invoices'];

  const parseResult =
    TargetAPIInvoiceOverviewObjectArrayZod.nonempty().safeParse(
      invoicesFromResponse,
    );

  if (!parseResult.success) {
    console.error(
      `[getTargetAPIOrderInvoiceOverviewDataFromAPI] Server response doesn't match expected schema. We'll try to recover anyway.`,
      parseResult.error,
    );
  }

  const invoices = invoicesFromResponse as TargetAPIInvoiceOverviewObjectArray;

  // if (invoices.length === 0) {
  //   throw new Error(
  //     '[getTargetAPIOrderInvoiceOverviewDataFromAPI] Invoice overview API returned no invoices. This should not happen. If there are no invoices, the endpoint just returns an error code.',
  //   );
  // }

  console.log(
    `Received invoice overview data for: ${invoices.length} invoice(s) for order ${orderNumber}`,
  );

  return invoices;
}

/**
 * Individual Invoice Data: The detailed data for a specific invoice
 */
export async function getTargetAPIOrderIndividualInvoiceDataFromAPI({
  fetchConfig,
  orderNumber,
  invoiceNumber,
}: {
  fetchConfig: FetchConfigWithResponse;
  invoiceNumber: string;
  orderNumber: string;
}): Promise<InvoiceDetail | null> {
  const apiResponse = await fetch(
    getTargetAPIInvoiceEndpointURL({invoiceNumber, orderNumber}),
    {
      ...fetchConfig.requestInit,
      referrer: getTargetOrderInvoiceBrowserURL({invoiceNumber, orderNumber})
        .url,
    },
  );

  const responseJson = await getJSONNoThrow(apiResponse);

  if (!isJsObject(responseJson)) {
    const message =
      '[getTargetAPIOrderIndividualInvoiceDataFromAPI] responseJson is not an object. This should not happen';
    console.warn(message, {responseJson});
    throw new Error(message);
  }

  if (
    'code' in responseJson &&
    responseJson['code'] === TARGET_RESOURCE_NOT_FOUND_CODE
  ) {
    console.log(
      '[getTargetAPIOrderIndividualInvoiceDataFromAPI] Target API reports resource not found. This can happen when an order was cancelled without any charges/refunds, or when an order is still processing.',
      responseJson,
    );
    return null;
  }

  const parseResult = InvoiceDetailZod.safeParse(responseJson);

  if (!parseResult.success) {
    console.error(
      `[getTargetAPIOrderIndividualInvoiceDataFromAPI] Server response doesn't match expected schema. We'll try to recover anyway.`,
      parseResult.error,
    );
  }

  return responseJson as InvoiceDetail;
}

/**
 * Order Aggregations Data - contains item categorization information
 */
export async function getTargetAPIOrderAggregationsDataFromAPI({
  fetchConfig,
  orderNumber,
}: {
  fetchConfig: FetchConfigWithResponse;
  orderNumber: string;
}): Promise<TargetAPIOrderAggregationsData> {
  const apiResponse = await fetch(
    getTargetAPIOrderAggregationsEndpointURL(orderNumber),
    {
      ...fetchConfig.requestInit,
      referrer: getTargetOrderBrowserURL(orderNumber),
    },
  );

  const responseJson = await getJSONNoThrow(apiResponse);

  if (!isJsObject(responseJson)) {
    const message =
      '[getTargetAPIOrderAggregationsDataFromAPI] responseJson is not an object. This should not happen';
    console.warn(message, {responseJson});
    throw new Error(message);
  }

  // NOTE: we're intentionally not using passthrough here in order to limit the amount of extraneous data we end up keeping
  const parseResult = TargetAPIOrderAggregationsDataZod.safeParse(responseJson);

  if (!parseResult.success) {
    console.error(
      `[getTargetAPIOrderAggregationsDataFromAPI] Server response doesn't match expected schema. We'll try to recover anyway.`,
      parseResult.error,
    );
  }

  // Let's return all the data we get from the server, even if it doesn't match our schema.
  // We'll strip out the keys that don't show up in our schema later.
  return responseJson as TargetAPIOrderAggregationsData;
}

/**
 * Individual Invoice Data: The detailed data for a specific invoice
 */
export async function deprecated__getTargetAPIOrderIndividualInvoiceDataFromBrowser({
  orderNumber,
  invoiceNumber,
  page,
}: {
  invoiceNumber: string;
  orderNumber: string;
  page: Page;
}): Promise<unknown> {
  const {url: invoiceURL, path: invoicePath} = getTargetOrderInvoiceBrowserURL({
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
export async function getTargetAPIOrderAllInvoiceDataFromAPI({
  orderNumber,
  fetchConfig,
}: {
  fetchConfig: FetchConfigWithResponse;
  orderNumber: string;
}): Promise<Array<InvoiceDetail>> {
  console.log('Getting invoice overview data for order:', orderNumber);

  const invoiceOverviewData = await getTargetAPIOrderInvoiceOverviewDataFromAPI(
    {
      fetchConfig,
      orderNumber,
    },
  );

  if (invoiceOverviewData == null) {
    console.log(
      `[getTargetAPIOrderAllInvoiceData] No invoice overview data found for order ${orderNumber}`,
    );
    return [];
  }

  const invoiceData = invoiceOverviewData.map(async (invoiceOverviewItem) => {
    console.log(
      `Getting individual invoice data for order ${orderNumber} and invoice ${invoiceOverviewItem['id']}...`,
    );
    const invoiceDetail = getTargetAPIOrderIndividualInvoiceDataFromAPI({
      fetchConfig,
      invoiceNumber: invoiceOverviewItem['id'],
      orderNumber,
    });

    return invoiceDetail;
  });

  return (await Promise.all(invoiceData)).filter(isNonNullable);
}
