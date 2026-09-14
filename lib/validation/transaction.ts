import { z } from "zod";
import Decimal from "decimal.js";

export const TRANSACTION_TYPES = [
  "BUY",
  "SELL",
  "DIVIDEND",
  "DEPOSIT",
  "WITHDRAWAL",
  "FEE",
  "TAX",
  "INTEREST",
  "TRANSFER",
  "SPLIT",
  "OTHER",
] as const;

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

const TYPES_REQUIRING_SECURITY = new Set(["BUY", "SELL", "DIVIDEND", "SPLIT"]);
const TYPES_REQUIRING_QUANTITY_PRICE = new Set(["BUY", "SELL"]);
const TYPES_REQUIRING_AMOUNT = new Set([
  "DIVIDEND",
  "DEPOSIT",
  "WITHDRAWAL",
  "INTEREST",
  "TRANSFER",
  "FEE",
  "TAX",
  "OTHER",
]);

/** A numeric string that must parse as a valid, finite decimal. */
const decimalString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((val) => {
    try {
      const parsed = new Decimal(val);
      return parsed.isFinite();
    } catch {
      return false;
    }
  }, "Must be a valid number");

const positiveDecimalString = decimalString.refine(
  (val) => new Decimal(val).greaterThan(0),
  "Must be greater than 0"
);

export const transactionInputSchema = z
  .object({
    accountId: z.string().min(1, "Account is required"),
    securityId: z.string().min(1).nullable().default(null),
    type: transactionTypeSchema,
    date: z.coerce.date(),
    quantity: positiveDecimalString.nullable().default(null),
    price: positiveDecimalString.nullable().default(null),
    /** Cash amount for non-trade transaction types (see computeTransactionAmounts). */
    amount: positiveDecimalString.nullable().default(null),
    fees: decimalString.default("0"),
    taxes: decimalString.default("0"),
    currency: z
      .string()
      .length(3, "Use a 3-letter ISO currency code")
      .toUpperCase(),
    exchangeRate: decimalString.nullable().default(null),
    notes: z.string().max(2000).optional(),
    externalId: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const requiresSecurity = TYPES_REQUIRING_SECURITY.has(data.type);
    if (requiresSecurity && !data.securityId) {
      ctx.addIssue({
        code: "custom",
        path: ["securityId"],
        message: `${data.type} requires a security`,
      });
    }
    if (!requiresSecurity && data.securityId) {
      ctx.addIssue({
        code: "custom",
        path: ["securityId"],
        message: `${data.type} must not reference a security`,
      });
    }

    if (TYPES_REQUIRING_QUANTITY_PRICE.has(data.type)) {
      if (!data.quantity) {
        ctx.addIssue({
          code: "custom",
          path: ["quantity"],
          message: `${data.type} requires a quantity`,
        });
      }
      if (!data.price) {
        ctx.addIssue({
          code: "custom",
          path: ["price"],
          message: `${data.type} requires a price`,
        });
      }
    } else if (data.quantity || data.price) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: `${data.type} must not have a quantity or price — use amount instead`,
      });
    }

    if (TYPES_REQUIRING_AMOUNT.has(data.type) && !data.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: `${data.type} requires an amount`,
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transactionUpdateSchema = transactionInputSchema;
