import type {Page} from 'playwright';

type LoadMoreConfig = {
  orderCount: number;
  page: Page;
};

async function getCurrentOrderCount(page: Page): Promise<number> {
  const orderLinksLocator = page.getByRole('link', {name: 'view order'});
  const orderLinksLocatorArray = await orderLinksLocator.all();
  return orderLinksLocatorArray.length;
}

// I could also maybe just listen for the order_history response and count the orders that way.
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

    const tmpOrderCountAfterWaitingForNthElement =
      await getCurrentOrderCount(page);
    console.log(
      'Order count after waiting for nth element:',
      tmpOrderCountAfterWaitingForNthElement,
    );

    // await page.waitForTimeout(5000);
    // const tmpOrderCountAfterTimeout = await getCurrentOrderCount(page);
    // console.log('Order count after timeout:', tmpOrderCountAfterTimeout);

    // currentOrderCount = tmpOrderCountAfterTimeout;

    currentOrderCount = tmpOrderCountAfterWaitingForNthElement;
  }

  console.log(`Finished loading ${currentOrderCount} orders`);
}
