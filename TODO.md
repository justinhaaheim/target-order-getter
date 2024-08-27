# ToDo

- [ ] Use order aggregations endoint to get data on the classification of order items: https://api.target.com/guest_order_aggregations/v1/912001882179637?pending_order=true&shipt_status=true
  - [ ] We can also use this to check `is_order_invoiced`, so we can skip querying the invoice overview endpoint if there are no invoices. Maybe worth it?
- [ ] Investigate if got-scraping will be of any use for making direct API calls
  - [ ] Does it remember cookie responses set with setCookie?
- [ ] Write out the invoice data as we go in case we get blocked or something throws
- [ ] Try adding a cache. Just need to be able to look up invoices by order number and know whether the previous fetch succeeded. We can assume for now that they won't change, but I think they _do_ change when there's a return. But... maybe that generates a separate invoice? So hopefully an invoices is essentially immutable after it's created??
- [ ] If the data doesn't match the schema still output the data, but just also include the error message from the parser. We don't want malformed data to crash the whole thing -- but we do want to be able to troubleshoot it
- [ ] Investigate whether the fetch call headers/cookies/etc from the target site change over time, or if I can just grab the cookies/data from one call and apply it everywhere.
- [ ] ⭐ Consider getting rid of data fields that are large and unneeded, like invoiceData.receipts. Or... just don't let through anything that i haven't explicitly typed with Zod?? That might be overall more efficient. Just type anything that seems potentially valuable. That's the way to go.
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
