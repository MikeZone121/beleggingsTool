import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center md:px-6 md:pt-24 md:pb-28">
      <Badge variant="secondary" className="mx-auto">
        Nu in beta — op uitnodiging
      </Badge>
      <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Je portefeuille, dividenden en belastingen op{" "}
        <span className="text-primary">één plek</span>.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
        Canopy volgt je beleggingen op de voet: live koersen, een dividendkalender die laat zien
        wanneer je volgende betaling binnenkomt, en overzichten die je fiscaliteit meteen
        duidelijk maken.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
          Start gratis
          <ArrowRight className="size-4" />
        </Button>
        <Button size="lg" variant="outline" render={<a href="#prijzen" />} nativeButton={false}>
          Bekijk de plannen
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Geen kredietkaart nodig voor het gratis plan. Signup is momenteel op uitnodiging.
      </p>
    </section>
  );
}
