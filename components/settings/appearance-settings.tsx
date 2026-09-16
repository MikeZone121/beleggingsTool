"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePrivacyMode } from "@/components/privacy-mode-provider";
import { cn } from "cn";

const THEME_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * The two display toggles that also live in the header, repeated here so
 * Settings is a complete picture of what's configurable rather than
 * silently omitting the preferences that happen to have a shortcut. Both
 * read and write the same state as the header controls, so the two never
 * disagree.
 */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { hidden, toggle } = usePrivacyMode();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Theme</div>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            // `theme` is undefined until next-themes hydrates; treating
            // that as "nothing selected" avoids briefly highlighting the
            // wrong option on first paint.
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-input text-muted-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
        <div>
          <div className="text-sm font-medium">Privacy mode</div>
          <p className="text-xs text-muted-foreground">
            Masks every amount, percentage and quantity on screen — for screen sharing or
            working in public. Remembered across sessions on this device.
          </p>
        </div>
        <Switch checked={hidden} onCheckedChange={toggle} aria-label="Privacy mode" />
      </div>
    </div>
  );
}
