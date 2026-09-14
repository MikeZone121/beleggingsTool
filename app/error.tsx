"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An unexpected error occurred. You can try again, or reload the page.
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </body>
    </html>
  );
}
