import {test} from '@playwright/test';

test('Get basic order information', async ({page}) => {
  // page is authenticated

  await page.goto('https://www.target.com/orders');

  const orderLinksLocator = await page.getByRole('link', {name: 'view order'});

  const firstHref = await orderLinksLocator.first().getAttribute('href');
  console.log('First href:', firstHref);

  const orderLinks = await orderLinksLocator.all();

  const hrefs = await Promise.all(
    orderLinks.map((link) => link.getAttribute('href')),
  );

  console.log('All hrefs:', hrefs);

  // const firstOrderHref = await page
  //   .getByRole('link', {name: 'view order'})
  //   .nth(0)
  //   .getAttribute('href');
  // console.log('First order href:', firstOrderHref);
});
