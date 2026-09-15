"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FormValues {
  currentPassword: string;
  newPassword: string;
}

export function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { currentPassword: "", newPassword: "" } });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to change password");
        return;
      }
      toast.success("Password changed");
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 sm:max-w-sm">
      <Field>
        <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...register("currentPassword", { required: "Required" })}
        />
        {errors.currentPassword && <FieldError>{errors.currentPassword.message}</FieldError>}
      </Field>
      <Field>
        <FieldLabel htmlFor="newPassword">New password</FieldLabel>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register("newPassword", {
            required: "Required",
            minLength: { value: 8, message: "At least 8 characters" },
          })}
        />
        {errors.newPassword && <FieldError>{errors.newPassword.message}</FieldError>}
      </Field>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
