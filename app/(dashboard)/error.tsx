"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <div>
        <h2 className="text-lg font-semibold">Couldn&apos;t load this page</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading this data."}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
