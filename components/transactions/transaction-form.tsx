"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { TRANSACTION_TYPES, transactionInputSchema } from "@/lib/validation/transaction";
import { SecuritySearchField, type SelectedSecurity } from "./security-search-field";

const TYPES_WITH_SECURITY = new Set(["BUY", "SELL", "DIVIDEND", "SPLIT"]);
const TYPES_WITH_QUANTITY_PRICE = new Set(["BUY", "SELL"]);

interface AccountOption {
  id: string;
  name: string;
}

interface SecurityOption {
  id: string;
  ticker: string;
  name: string;
  currency: string;
}

interface TransactionFormProps {
  accounts: AccountOption[];
  securities: SecurityOption[];
  onSuccess?: () => void;
  /** Present only when editing an existing transaction — switches the
   * submit target from POST /api/transactions to PATCH .../[id] and
   * pre-fills the form from `initialValues` instead of the blank
   * defaults. */
  transactionId?: string;
  initialValues?: FormValues & { security: SelectedSecurity | null };
}

type FormValues = {
  accountId: string;
  securityId: string | null;
  type: (typeof TRANSACTION_TYPES)[number];
  date: string;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fees: string;
  taxes: string;
  currency: string;
  notes: string;
};

const defaultValues: FormValues = {
  accountId: "",
  securityId: null,
  type: "BUY",
  date: new Date().toISOString().slice(0, 10),
  quantity: null,
  price: null,
  amount: null,
  fees: "0",
  taxes: "0",
  currency: "EUR",
  notes: "",
};

export function TransactionForm({
  accounts,
  securities,
  onSuccess,
  transactionId,
  initialValues,
}: TransactionFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEditing = transactionId !== undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    // Cast: transactionInputSchema's z.input type (with its `.default()`s
    // applied) doesn't line up 1:1 with this form's simplified string-based
    // FormValues; runtime validation is unaffected — the server re-validates
    // with the same schema regardless (see onSubmit).
    resolver: zodResolver(transactionInputSchema) as never,
    defaultValues: initialValues ?? { ...defaultValues, accountId: accounts[0]?.id ?? "" },
  });

  const [selectedSecurity, setSelectedSecurity] = useState<SelectedSecurity | null>(
    initialValues?.security ?? null
  );
  const [knownSecurities, setKnownSecurities] = useState(securities);

  const type = watch("type");
  const needsSecurity = TYPES_WITH_SECURITY.has(type);
  const needsQuantityPrice = TYPES_WITH_QUANTITY_PRICE.has(type);

  function handleSecuritySelect(security: SelectedSecurity) {
    setSelectedSecurity(security);
    setValue("securityId", security.id, { shouldValidate: true });
    setValue("currency", security.currency, { shouldValidate: true });
    // A security created inline (via the provider search) isn't in the
    // `securities` prop yet — remember it locally so it shows as "known"
    // immediately, without waiting for the page to re-fetch.
    setKnownSecurities((prev) =>
      prev.some((s) => s.id === security.id) ? prev : [...prev, security]
    );
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      // The API route re-validates with the same Zod schema server-side
      // (client validation is a UX nicety, never the source of truth), so
      // the JSON payload here is intentionally untyped — `date` travels as
      // the plain "YYYY-MM-DD" string and is coerced to a Date on the server.
      const payload: Record<string, unknown> = {
        ...values,
        securityId: needsSecurity ? values.securityId : null,
        quantity: needsQuantityPrice ? values.quantity : null,
        price: needsQuantityPrice ? values.price : null,
        amount: needsQuantityPrice ? null : values.amount,
      };

      const response = await fetch(
        isEditing ? `/api/transactions/${transactionId}` : "/api/transactions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        toast.error(
          result.error?.message ?? `Failed to ${isEditing ? "update" : "create"} transaction`
        );
        return;
      }

      toast.success(isEditing ? "Transaction updated" : "Transaction added");
      if (!isEditing) {
        reset({ ...defaultValues, accountId: values.accountId, currency: values.currency });
        setSelectedSecurity(null);
      }
      router.refresh();
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <select
            id="type"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            {...register("type")}
          >
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="date">Date</FieldLabel>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <FieldError>{errors.date.message}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="accountId">Account</FieldLabel>
          <select
            id="accountId"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            {...register("accountId")}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {errors.accountId && <FieldError>{errors.accountId.message}</FieldError>}
        </Field>

        {needsSecurity && (
          <Field>
            <FieldLabel htmlFor="securityId">Security</FieldLabel>
            <SecuritySearchField
              existingSecurities={knownSecurities}
              value={selectedSecurity}
              onSelect={handleSecuritySelect}
            />
            <input type="hidden" {...register("securityId")} />
            {errors.securityId && <FieldError>{errors.securityId.message}</FieldError>}
          </Field>
        )}

        {needsQuantityPrice ? (
          <>
            <Field>
              <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
              <Input id="quantity" inputMode="decimal" {...register("quantity")} />
              {errors.quantity && <FieldError>{errors.quantity.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="price">Price per share</FieldLabel>
              <Input id="price" inputMode="decimal" {...register("price")} />
              {errors.price && <FieldError>{errors.price.message}</FieldError>}
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="amount">Amount</FieldLabel>
            <Input id="amount" inputMode="decimal" {...register("amount")} />
            {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="fees">Fees</FieldLabel>
          <Input id="fees" inputMode="decimal" {...register("fees")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="taxes">Taxes</FieldLabel>
          <Input id="taxes" inputMode="decimal" {...register("taxes")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <Input id="currency" maxLength={3} {...register("currency")} />
          {errors.currency && <FieldError>{errors.currency.message}</FieldError>}
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Input id="notes" {...register("notes")} />
      </Field>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEditing ? "Save changes" : "Add transaction"}
      </Button>
    </form>
  );
}
