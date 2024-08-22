import {z} from 'zod';

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

const InvoiceDetail = z.object({
  date: z.string(), // "2024-08-18T20:41:55.000Z",
  id: z.string(),
  lines: z.array(InvoiceLinesObject),
  payments: z.array(PaymentDetail),
  total_amount: z.number(), // 13.19
  type: z.string(), // "SHIPMENT"
});
