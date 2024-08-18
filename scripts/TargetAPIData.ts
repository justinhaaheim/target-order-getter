import type {BrowserContext, Page} from 'playwright';

import {TARGET_ORDER_PAGE_URL} from './Constants';
import {loadMoreOrdersUntilOrderCount} from './Helpers';

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

export async function getTargetAPIOrderHistoryData({
  orderCount,
  page,
}: GetTargetAPIOrderHistoryConfig): Promise<TargetAPIOrderHistoryItem[]> {
  const orderResponsePages: Array<Array<unknown>> = [];

  const onPageResponse = async (response) => {
    // console.log('<<', response.status(), response.url());

    if (response.url().includes('order_history')) {
      const responseJson = await response.json();

      const pageNumber = responseJson['request']?.['page_number'];
      const pageSize = responseJson['request']?.['page_size'];
      const ordersArray = responseJson['orders'];

      console.log(
        `Received order_history data for page number ${pageNumber} (page size: ${pageSize})`,
      );

      if (typeof pageNumber !== 'number' || typeof pageSize !== 'number') {
        throw new Error('Page number or page size is not a number');
      }

      if (orderResponsePages[pageNumber] != null) {
        console.log(
          `Overwriting existing order data for page number ${pageNumber}`,
          {
            ordersArray,
            pageNumber,
            pageSize,
          },
        );
      }
      orderResponsePages[pageNumber] = ordersArray;
    }
  };

  page.on('response', onPageResponse);

  await page.goto(TARGET_ORDER_PAGE_URL);

  // Load more orders
  await loadMoreOrdersUntilOrderCount({orderCount: orderCount, page});

  const orderData = orderResponsePages.flat();

  console.log(
    `Order data from API responses (length: ${orderData.length}):`,
    // JSON.stringify(orderData, null, 2),
    orderData,
  );

  page.off('response', onPageResponse);

  if (!isTargetOrderHistory(orderData)) {
    throw new Error('Order data is not in expected format');
  }

  return orderData;
}

// Overview data is just the high level list of invoices, without specific details
export async function getTargetAPIOrderInvoiceOverviewData({
  orderNumber,
  page,
}: {
  orderNumber: string;
  page: Page;
}): Promise<TargetAPIInvoiceOverviewItem[]> {
  const invoiceOverviewURL = getTargetOrderInvoicesURL(orderNumber);

  const invoicesOverviewMap = new Map();

  const onInvoicesResponse = async (response) => {
    if (response.url().includes(`orders/${orderNumber}/invoices`)) {
      const data = await response.json();
      console.log('Received invoice data:', data);

      const invoices = data['invoices'];
      invoices.forEach((invoice) => {
        const id = invoice['id'];
        if (id == null) {
          console.warn(
            '[getTargetAPIOrderInvoiceData] Invoice ID is null. This should not happen',
            invoice,
          );
        }
        invoicesOverviewMap.set(id, invoice);
      });
    }
  };

  page.on('response', onInvoicesResponse);

  // TODO: Is pagination ever needed for a large number of invoices?
  await page.goto(invoiceOverviewURL);

  // Wait for at least one invoice link to appear
  await page.getByRole('link', {name: 'View invoice'}).waitFor();

  const invoiceOverviewList = Array.from(invoicesOverviewMap.values());

  if (invoiceOverviewList.length === 0) {
    throw new Error('[getTargetAPIOrderInvoiceData] No invoices found');
  }

  if (!isTargetInvoiceOverviewList(invoiceOverviewList)) {
    throw new Error('Invoice overview data is not in expected format');
  }
  return invoiceOverviewList;
}

// Get details on a specific invoice
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

  const onInvoiceResponse = async (response) => {
    // Target's API mirrors the web navigation structure, so we can just use the path here to identify responses from the invoice API
    if (response.url().includes(invoicePath)) {
      const data = await response.json();
      console.log('Received invoice data:', data);
      invoiceData = data;
    }
  };

  page.on('response', onInvoiceResponse);

  await page.goto(invoiceURL);

  // Wait for the invoice number to be populated in the UI
  await page.getByText(/Invoice number\: \d+/i).waitFor();

  if (invoiceData == null) {
    throw new Error(
      '[getTargetAPIOrderIndividualInvoiceData] No invoice data found',
    );
  }

  return invoiceData;
}

export async function getTargetAPIOrderAllInvoiceData({
  orderNumber,
  page,
  context,
}: {
  context: BrowserContext;
  orderNumber: string;
  page: Page;
}): Promise<unknown> {
  const invoiceOverviewData = await getTargetAPIOrderInvoiceOverviewData({
    orderNumber,
    page,
  });

  const invoiceDataPromises = invoiceOverviewData.map(
    async (invoiceOverviewItem) => {
      const newPage = await context.newPage();

      const data = await getTargetAPIOrderIndividualInvoiceData({
        invoiceNumber: invoiceOverviewItem['id'],
        orderNumber,
        page: newPage,
      });

      // TODO: close pages, if it's useful
      // await newPage.close();

      return data;
    },
  );

  return await Promise.all(invoiceDataPromises);
}
