"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SecurityFormFields,
  toSecurityPayload,
  type SecurityFormValues,
} from "./security-form-fields";

export interface EditableSecurity extends SecurityFormValues {
  id: string;
}

/**
 * Corrects a security's reference data. The ticker matters most: the
 * market-data providers key off it (Yahoo needs the exchange suffix —
 * "BNP.PA", not "BNP"), and until now a wrong one could only be fixed in
 * the database.
 *
 * Controlled from the row that opened it (`security` + `onClose`) rather
 * than owning its own trigger, so the Securities table can render one
 * dialog for whichever row is being edited instead of one per row.
 */
export function EditSecurityDialog({
  security,
  onClose,
}: {
  security: EditableSecurity | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SecurityFormValues>({
    values: security ?? undefined,
  });

  async function onSubmit(values: SecurityFormValues) {
    if (!security) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch(`/api/securities/${security.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSecurityPayload(values)),
      });
      const result = await response.json();

      if (!response.ok) {
        const firstDetail = Object.values(result.error?.details ?? {})[0] as string[] | undefined;
        setServerError(firstDetail?.[0] ?? result.error?.message ?? "Failed to update security");
        return;
      }

      toast.success(`${values.ticker} updated`);
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={security !== null}
      onOpenChange={(next) => {
        if (!next) {
          setServerError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit security</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <SecurityFormFields register={register} errors={errors} idPrefix="edit-security" />

          <FieldDescription>
            The ticker is what price and dividend lookups are sent as — Yahoo Finance expects an
            exchange suffix (BNP.PA, ASML.AS), Twelve Data a plain symbol plus the exchange field.
          </FieldDescription>

          {serverError && <FieldError>{serverError}</FieldError>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
