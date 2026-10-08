import Link from "next/link";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
          <Leaf className="size-5 text-primary" />
          Canopy
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#functies" className="hover:text-foreground">
            Functies
          </a>
          <a href="#prijzen" className="hover:text-foreground">
            Prijzen
          </a>
          <a href="#faq" className="hover:text-foreground">
            Veelgestelde vragen
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />} nativeButton={false}>
            Inloggen
          </Button>
          <Button render={<Link href="/signup" />} nativeButton={false}>
            Start gratis
          </Button>
        </div>
      </div>
    </header>
  );
}
