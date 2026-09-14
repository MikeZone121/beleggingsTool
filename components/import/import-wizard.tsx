"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GENERIC_CSV_FIELDS, type ColumnMapping } from "@/lib/importers/types";
import { guessColumnMapping } from "@/lib/importers/generic/csvParser";

interface AccountOption {
  id: string;
  name: string;
}

interface PreviewRow {
  rowNumber: number;
  status: "valid" | "error" | "duplicate";
  errors: string[];
  input: { type: string; date: string; currency: string; netAmount?: string } | null;
}

type Step = "upload" | "mapping" | "preview" | "done";

const FIELD_LABELS: Record<(typeof GENERIC_CSV_FIELDS)[number], string> = {
  date: "Date *",
  type: "Type *",
  ticker: "Ticker",
  quantity: "Quantity",
  price: "Price",
  amount: "Amount",
  fees: "Fees",
  taxes: "Taxes",
  currency: "Currency",
  notes: "Notes",
  externalId: "External ID (for duplicate detection)",
};

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<{ totalRows: number; imported: number; duplicates: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);

    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const detectedHeaders = firstLine.split(",").map((h) => h.trim());
    setHeaders(detectedHeaders);

    setMapping(guessColumnMapping(detectedHeaders));
    setStep("mapping");
  }

  async function loadPreview() {
    setBusy(true);
    try {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mapping, accountId }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to preview import");
        return;
      }
      setRows(result.data.results);
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    setBusy(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mapping, accountId, fileName }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Import failed");
        return;
      }
      setSummary(result.data);
      setStep("done");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const validCount = rows.filter((r) => r.status === "valid").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  if (step === "upload") {
    return (
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="import-account">Account</FieldLabel>
          <select
            id="import-account"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-file">CSV file</FieldLabel>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </Field>
      </div>
    );
  }

  if (step === "mapping") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Map your CSV&apos;s columns to the fields below. Fields marked * are always required;
          others depend on the transaction type (see the transaction form for the same rules).
        </p>
        <div className="grid grid-cols-2 gap-4">
          {GENERIC_CSV_FIELDS.map((field) => (
            <Field key={field}>
              <FieldLabel htmlFor={`map-${field}`}>{FIELD_LABELS[field]}</FieldLabel>
              <select
                id={`map-${field}`}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={mapping[field] ?? ""}
                onChange={(e) =>
                  setMapping((prev) => ({ ...prev, [field]: e.target.value || undefined }))
                }
              >
                <option value="">Not mapped</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button onClick={loadPreview} disabled={busy || !mapping.date || !mapping.type}>
            {busy ? "Loading…" : "Preview"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 text-sm">
          <Badge variant="secondary">{validCount} valid</Badge>
          {errorCount > 0 && <Badge variant="destructive">{errorCount} with errors</Badge>}
        </div>
        <div className="max-h-96 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "valid" ? "secondary" : "destructive"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.input?.type ?? "—"}</TableCell>
                  <TableCell>{row.input?.date ? String(row.input.date).slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-xs text-destructive">
                    {row.errors.join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("mapping")}>
            Back
          </Button>
          <Button onClick={confirmImport} disabled={busy || validCount === 0}>
            {busy ? "Importing…" : `Import ${validCount} transaction${validCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Import complete</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>{summary?.imported ?? 0} imported</li>
          <li>{summary?.duplicates ?? 0} duplicates skipped</li>
          <li>{summary?.failed ?? 0} failed</li>
        </ul>
      </div>
      <Button
        onClick={() => {
          setStep("upload");
          setCsvText("");
          setRows([]);
          setSummary(null);
        }}
      >
        Import another file
      </Button>
    </div>
  );
}
