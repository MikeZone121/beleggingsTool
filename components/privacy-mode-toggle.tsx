"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacyMode } from "@/components/privacy-mode-provider";

export function PrivacyModeToggle() {
  const { hidden, toggle } = usePrivacyMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      aria-pressed={hidden}
      onClick={toggle}
    >
      {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  );
}
