// import fetch from 'node-fetch';

const result = await fetch(
  'https://api.target.com/guest_order_aggregations/v1/order_history?page_number=1&page_size=20&order_purchase_type=ONLINE&pending_order=true&shipt_status=true',
  {
    body: null,
    headers: {
      Referer: 'https://www.target.com/orders',
      'Referrer-Policy': 'no-referrer-when-downgrade',
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9,es;q=0.8',
      cookie:
        'TealeafAkaSid=Pd3RUERamn_jsi8jdRsq4tUaYNW15_sm; visitorId=019161E51022020193C7D73F0597A004; sapphire=1; UserLocation=94061|37.460|-122.230|CA|US; login-session=YU9reXJqmQ8yH1ikE-ouqtsiwrWIq1CtLxmzugomaHZmtYRrHjeKFqJpOrAXOEx-; 3YCzT93n=AyE25WGRAQAApHu5NGRpMUpozi3-qMWoi1LyjbrJF5APKw3Dj-QOECr_Dyh5AWxVbT2uck0XwH9eCOfvosJeCA|1|1|230c42034452a43904a2777ec753c8319771f12f; mid=2735476311; usprivacy=1NN-; stateprivacycontrols=N; hasApp=true; loyaltyid=tly.aae34f83f6d84a21b52384d54c3e5e96; hasRC=true; sapphire_audiences={%22base_membership%22:true%2C%22card_membership%22:true%2C%22paid_membership%22:false}; fiatsCookie=DSI_1122|DSN_San%20Mateo%20Fashion%20Island|DSZ_94404; sddStore=DSI_321|DSN_Redwood%20City|DSZ_94061; mystate=1724029230514; egsSessionId=b7cb7989-234a-4daa-b896-00ee1e109ecd; accessToken=eyJraWQiOiJlYXMyIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIyNzM1NDc2MzExIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzI0MTA4MDU0LCJpYXQiOjE3MjQwOTM2NTQsImp0aSI6IlRHVC45NGRjN2Q3Y2Y0ODA0M2U2YjAyNDkyN2MyYzU3MDFlOC1tIiwic2t5IjoiZWFzMiIsInN1dCI6IlIiLCJkaWQiOiIwOTU2M2YwMWQzNTcyYzlkNzlmMjBjMmQzNzEwMDYzNGU2YWE3OTMwMmFiNmQ1ZjgxZGJmZGNhMTQ0MjgyNmM3IiwiZWlkIjoianVzdGluYW5ka2VzYUBnbWFpbC5jb20iLCJzY28iOiJlY29tLm1lZCxvcGVuaWQiLCJjbGkiOiJlY29tLXdlYi0xLjAuMCIsInR2MSI6IjU3MjU2MzQ4OCIsImFzbCI6Ik0ifQ.OrJ_7gX95K5MEw-_BDkvvRzBU-U1_RTDliD8oKBKW8qSRdaYRUFM4yAs8bGyhy8KTzwjEQHiRQtrcdFsqcDj15I_McjIAEG3mvCOYtj8UGJljdhZup9xDZ9s-RJVlAXht6JLAx1UdF4v35RrBdcRalYnSrdl33uYkZaVKCdu_lnCdskHjEqVcs3caEwfs3iTswXpibztp_1QP0XdSnHeUaltd0hW0NEsraXNGX_v6ANmo_GwWMvRenfOAV1f0M-LM5G7tSiYVrsNonde4MfXPnhIQl3W2iYUQogCVyUgHpg4wxdSuUGLJGalxXCxgVXAYUwAqeWgJX1Zb0JmR2z8yg; idToken=eyJhbGciOiJub25lIn0.eyJzdWIiOiIyNzM1NDc2MzExIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzI0MTA4MDU0LCJpYXQiOjE3MjQwOTM2NTQsImFzcyI6Ik0iLCJzdXQiOiJSIiwiY2xpIjoiZWNvbS13ZWItMS4wLjAiLCJwcm8iOnsiZm4iOiJKdXN0aW4iLCJlbSI6Imp1c3RpbmFuZGtlc2FAZ21haWwuY29tIiwicGgiOnRydWUsImxlZCI6bnVsbCwibHR5Ijp0cnVlLCJzdCI6IkNBIn19.; refreshToken=TGT.94dc7d7cf48043e6b024927c2c5701e8-m; adScriptData=CA; ffsession={%22sessionHash%22:%221b091f166741381723924287822%22%2C%22prevPageName%22:%22Order%20History%22%2C%22prevPageType%22:%22order-history%22%2C%22prevPageUrl%22:%22https://www.target.com/orders%22%2C%22sessionHit%22:57}',
      priority: 'u=1, i',
      'sec-ch-ua':
        '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'x-api-key': 'ff457966e64d5e877fdbad070f276d18ecec4a01',
    },
    method: 'GET',
  },
);

console.log('result:', await result.json());

export {};
