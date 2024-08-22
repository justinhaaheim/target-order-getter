import {z} from 'zod';

///////////////////////////////////////////////////////////
// Invoice Data
///////////////////////////////////////////////////////////
const PaymentDetail = z.object({
  display_card_number: z.string(),
  sub_type_value: z.string(), // "Target Circle Credit Card"
  total_charged: z.number(),
  type: z.string(),
});

const InvoiceLinesObjectItem = z.object({
  description: z.string(),
  tcin: z.string(),
});

const InvoiceLinesObject = z.object({
  amount: z.number(), // This is just `quantity * unit_price`
  // charges: ...
  discount: z.number(), // For a line item like "Target Circle Card 5%"
  effective_amount: z.number(), // this is the ACTUAL final total
  id: z.string(),
  invoice_key: z.string(),
  item: InvoiceLinesObjectItem,
  order_line_key: z.string(),
  quantity: z.number(),
  sub_total: z.number(), // This is `amount - discount`
  total_tax: z.number(),
  unit_price: z.number(), // how much each item costs
});

/**
 * Instead, if you want to pass through unknown keys, use .passthrough() .
 * 
 * person.passthrough().parse({
  name: "bob dylan",
  extraKey: 61,
});
 */
const InvoiceDetailZod = z.object({
  date: z.coerce.date(), // "2024-08-17T19:05:52.000Z"
  // date: z.string(), // "2024-08-18T20:41:55.000Z",
  id: z.string(),
  lines: z.array(InvoiceLinesObject),
  payments: z.array(PaymentDetail),
  total_amount: z.number(), // 13.19
  type: z.string(), // "SHIPMENT"
  // addresses: ...
  // fulfillment: ...
  // receipts: ...
});

export type InvoiceDetail = z.infer<typeof InvoiceDetailZod>;

export const TargetAPIInvoiceOverviewObjectZod =
  // z.record(z.unknown()).and(
  z
    .object({
      amount: z.number(),
      date: z.coerce.date(), // "2024-08-17T19:05:52.000Z"
      id: z.string(),
      receipt_id: z.string(),
      type: z.string(), // "SHIPMENT"
    })
    // TODO: Decide if passthrough is the right way to handle this
    .passthrough();
// );

export type TargetAPIInvoiceOverviewObject = z.infer<
  typeof TargetAPIInvoiceOverviewObjectZod
>;

export const TargetAPIInvoiceOverviewObjectArrayZod = z.array(
  TargetAPIInvoiceOverviewObjectZod,
);

export type TargetAPIInvoiceOverviewObjectArray = z.infer<
  typeof TargetAPIInvoiceOverviewObjectArrayZod
>;

///////////////////////////////////////////////////////////
// Order History Data
///////////////////////////////////////////////////////////
// Generated by ts-to-zod

const TargetAPIOrderLinesObjectZod = z.object({
  item: z.object({
    description: z.string(), // "Organic Bananas - 1lb - Good & Gather™"
    tcin: z.string(), // "24010659"
  }),
  line_type: z.string().optional(), // "GROCERY"
  order_line_id: z.string(), // "aef6fb40-5cc1-11ef-9a7e-353d5f9b165f"
  original_quantity: z.number(),
});

// Originally this was export const targetAPIOrderHistoryItemSchema = z.record(z.unknown()).and( ...
// which lets in any arbitrary keys.
export const TargetAPIOrderHistoryObjectZod = z.record(z.unknown()).and(
  z.object({
    // address: (store address) ...
    order_lines: z.array(TargetAPIOrderLinesObjectZod),
    order_number: z.string(),
    order_purchase_type: z.string(), // "ONLINE"
    placed_date: z.string(), // "2024-08-17T12:58:39-05:00",
    summary: z.object({
      grand_total: z.string(), // Strange this isn't a number
    }),
  }),
);

export type TargetAPIOrderHistoryObject = z.infer<
  typeof TargetAPIOrderHistoryObjectZod
>;

export const TargetAPIOrderHistoryObjectArrayZod = z.array(
  TargetAPIOrderHistoryObjectZod,
);

export type TargetAPIOrderHistoryObjectArray = z.infer<
  typeof TargetAPIOrderHistoryObjectArrayZod
>;
