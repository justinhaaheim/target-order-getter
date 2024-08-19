// For more information, see https://crawlee.dev/
import {PlaywrightCrawler, ProxyConfiguration} from 'crawlee';

import {router} from './crawleeRoutes.js';

const startUrls = ['https://crawlee.dev'];

const crawler = new PlaywrightCrawler({
  // Comment this option to scrape the full website.
  maxRequestsPerCrawl: 20,

  // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
  requestHandler: router,
});

await crawler.run(startUrls);
