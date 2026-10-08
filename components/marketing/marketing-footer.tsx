import Link from "next/link";
import { Leaf } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-6">
        <Link href="/" className="flex items-center gap-2 font-medium text-foreground">
          <Leaf className="size-4 text-primary" />
          Canopy
        </Link>
        <nav className="flex items-center gap-5">
          <a href="#functies" className="hover:text-foreground">
            Functies
          </a>
          <a href="#prijzen" className="hover:text-foreground">
            Prijzen
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link href="/login" className="hover:text-foreground">
            Inloggen
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} Canopy</p>
      </div>
    </footer>
  );
}
