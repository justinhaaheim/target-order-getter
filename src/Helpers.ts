import type {Page, Request, Response as PlaywrightResponse} from 'playwright';

type LoadMoreConfig = {
  orderCount: number;
  page: Page;
};

export type FetchConfig = {
  apiURL: URL;
  requestInit: RequestInit;
};

export type FetchConfigWithResponse = FetchConfig & {
  apiResponse: PlaywrightResponse;
  browserURLResponse: PlaywrightResponse | null;
};

export async function getJSONNoThrow(
  response: PlaywrightResponse | Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}

async function getCurrentOrderCount(page: Page): Promise<number> {
  const orderLinksLocator = page.getByRole('link', {name: 'view order'});
  const orderLinksLocatorArray = await orderLinksLocator.all();
  return orderLinksLocatorArray.length;
}

/**
 *
 * @param param0
 * @returns the fetch config used to make an endpoint request when loading browserURL
 */
export async function getFetchConfig({
  browserURL,
  page,
  endpointURLToWatch,
}: {
  browserURL: string;
  endpointURLToWatch: string;
  page: Page;
}): Promise<FetchConfigWithResponse> {
  console.log('🕵🏽 Getting fetch config for endpoint:', endpointURLToWatch);

  const endpointURLToWatchObject = new URL(endpointURLToWatch);

  // Don't await here -- we want to add the listener now before we navigate to the page, and await later
  const apiResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    console.debug(
      `[getFetchConfig] Response received from ${url}:`,
      response.status(),
    );

    // NOTE: We may want to rethink how precisely we are/are not matching the endpoint url. Should it just be a strict url.startsWith(endpointURLToWatch) check?
    return (
      url.host === endpointURLToWatchObject.host &&
      url.pathname === endpointURLToWatchObject.pathname
    );
  });

  // TODO: Add optional referrer url
  const browserURLResponse = await page.goto(browserURL);

  const apiResponse = await apiResponsePromise;

  if (!apiResponse.ok()) {
    throw new Error(
      `[getFetchConfig] Response from endpoint is not OK. Endpoint: ${endpointURLToWatch}. Response status: ${apiResponse.status()}`,
    );
  }

  const fetchConfig = await extractFetchConfigFromRequest(
    apiResponse.request(),
  );
  return {...fetchConfig, apiResponse, browserURLResponse};
}

export async function extractFetchConfigFromRequest(
  request: Request,
): Promise<FetchConfig> {
  const apiURL = new URL(request.url());
  const headers = await request.allHeaders();
  console.debug('[extractFetchConfigFromRequest] all headers:', headers);
  // console.debug(
  //   '[extractFetchConfigFromRequest] all headers array:',
  //   await request.headersArray(),
  // );

  const newHeaders: HeadersInit = {};
  for (const [key, value] of Object.entries(headers)) {
    // Skip HTTP/2 pseudo-headers
    if (!key.startsWith(':')) {
      newHeaders[key] = value;
    }
  }

  const requestMethod = request.method();

  // TODO: Possibly support other methods?
  if (requestMethod !== 'GET') {
    throw new Error(
      `[extractFetchConfigFromRequest] Unsupported request method: ${requestMethod}`,
    );
  }

  const fetchConfig = {
    apiURL,
    requestInit: {
      // body: null, // Let's not specify the body at all
      headers: newHeaders,
      method: requestMethod,
    },
  };
  console.log('[extractFetchConfigFromRequest] fetchConfig:', fetchConfig);
  return fetchConfig;
}

/**
 * NOTE: this assumes we're already on the target order page
 */
export async function loadMoreOrdersUntilOrderCount({
  page,
  orderCount,
}: LoadMoreConfig): Promise<void> {
  console.log(
    '[loadMoreOrdersUntilOrderCount] Loading more orders until order count >=',
    orderCount,
  );
  let currentOrderCount = await getCurrentOrderCount(page);
  console.log('Current order count:', currentOrderCount);

  while (currentOrderCount < orderCount) {
    console.log('Loading more orders...');
    await page.getByRole('button', {name: 'Load more orders'}).click();
    const tmpOrderCountImmediatelyAfterLoadMoreResolves =
      await getCurrentOrderCount(page);
    console.log(
      "Order count immediately after 'Load more' resolves:",
      tmpOrderCountImmediatelyAfterLoadMoreResolves,
    );

    const orderLinksLocator = page.getByRole('link', {name: 'view order'});
    await orderLinksLocator.nth(currentOrderCount + 1).waitFor();

    const orderCountAfterWaitingForNthElement =
      await getCurrentOrderCount(page);
    console.log(
      'Order count after waiting for nth element:',
      orderCountAfterWaitingForNthElement,
    );

    // await page.waitForTimeout(5000);
    // const tmpOrderCountAfterTimeout = await getCurrentOrderCount(page);
    // console.log('Order count after timeout:', tmpOrderCountAfterTimeout);

    // currentOrderCount = tmpOrderCountAfterTimeout;

    currentOrderCount = orderCountAfterWaitingForNthElement;
  }

  console.log(`Finished loading ${currentOrderCount} orders`);
}
