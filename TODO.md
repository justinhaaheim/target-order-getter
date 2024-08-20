# ToDo

- [ ] Add fingerprinting library
- [ ] Try opening invoices in parallel on multiple pages, with referrer set
- [ ] Listen for requestfinished, not response as that doesn't guarantee the response body is there. https://playwright.dev/docs/api/class-page#page-event-request-finished
- [ ] Add winston logger so I can adjust log level, and so I can log to a file if need be.
- [ ] Try enabling node debugger
- [x] Add retry logic if we don't get the data we're expecting, or if the page fails to load
- [ ] Try just hitting the target APIs directly, with the API key
- [ ] ⭐ Start integrating with crawlee for browser fingerprinting help. Not entirely clear how to fill in all the data from the separate request handlers, but it should be doable. Maybe just a big map/object keyed on order #, and then with properties filled in as we go?
