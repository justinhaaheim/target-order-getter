# ToDo

- [ ] Investigate whether the fetch call headers/cookies/etc from the target site change over time, or if I can just grab the cookies/data from one call and apply it everywhere.
- [ ] Consider getting rid of data fields that are large and unneeded, like invoiceData.receipts
- [ ] Maybe add the ability to cache previous responses, so we can limit how much we're having to hit the API. Can be very simple at first: just a json file with previous responses. Use the API endpoint as a key
- [ ] Figure out what should happen if there's no data or json throws in each of the functions that fetch some data. What should be returned??
- [ ] Figure out how to programmatically specify that the referrer url needs to be manually specified for functions like getTargetAPIOrderInvoiceOverviewData. The referrer URL should change for each new order number.
- [x] Add fingerprinting library (or stealth plugin)
- [x] Use async-sema to control how many requests are in flight at the same time
- [ ] Use Zod to type and validate responses from the API
- [ ] Try opening invoices in parallel on multiple pages, with referrer set
- [ ] Listen for requestfinished, not response as that doesn't guarantee the response body is there. https://playwright.dev/docs/api/class-page#page-event-request-finished
- [ ] Add winston logger so I can adjust log level, and so I can log to a file if need be.
- [x] Try enabling node debugger
- [x] Add retry logic if we don't get the data we're expecting, or if the page fails to load
- [x] Try just hitting the target APIs directly, with the API key
- [x] ⭐ Start integrating with crawlee for browser fingerprinting help. Not entirely clear how to fill in all the data from the separate request handlers, but it should be doable. Maybe just a big map/object keyed on order #, and then with properties filled in as we go?

- [ ] Write a function that extracts categorization info about the items from the order main page, using order_lines[number].item.product_classification.product_type_name
