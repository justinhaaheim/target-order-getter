import type {Page, Response} from 'playwright';

type LoadMoreConfig = {
  orderCount: number;
  page: Page;
};

export async function getJSONNoThrow(response: Response): Promise<unknown> {
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
