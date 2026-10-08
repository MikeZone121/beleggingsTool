import {
  CalendarClock,
  FileText,
  LineChart,
  PieChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Portefeuille & rendement",
    description:
      "Eén dashboard met je totale waarde, winst/verlies en dagelijkse bewegingen — automatisch bijgewerkt met live koersen.",
  },
  {
    icon: CalendarClock,
    title: "Dividendkalender",
    description:
      "Zie per aandeel het betaalritme en hoeveel dividend je de komende 30 dagen kan verwachten, tot op de euro.",
  },
  {
    icon: LineChart,
    title: "Watchlist met grafieken",
    description:
      "Volg tickers die je nog niet in portefeuille hebt, met koersgrafieken inclusief SMA 25/50/100 en Fibonacci-retracement.",
  },
  {
    icon: PieChart,
    title: "Analytics & spreiding",
    description:
      "Analyseer je allocatie en diversificatie per activaklasse, sector en munt — en zie meteen waar je scheef zit.",
  },
  {
    icon: Sparkles,
    title: "Slimme insights",
    description:
      "Automatische signalen over concentratierisico, onbenutte kansen en opvallende bewegingen in je portefeuille.",
  },
  {
    icon: FileText,
    title: "Belastingoverzicht",
    description:
      "Een jaaroverzicht van roerende voorheffing en meerwaarden, zodat je aangifte geen giswerk meer is.",
  },
  {
    icon: Upload,
    title: "CSV-import",
    description:
      "Importeer transacties rechtstreeks vanuit je broker in enkele klikken — geen handmatige invoer nodig.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-modus",
    description:
      "Verberg bedragen met één klik wanneer je scherm deelt, en schakel vrij tussen licht en donker thema.",
  },
];

export function FeaturesSection() {
  return (
    <section id="functies" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Alles wat je nodig hebt om te beleggen met overzicht</h2>
        <p className="mt-3 text-muted-foreground">
          Canopy vervangt je spreadsheet door een dashboard dat zelf meerekent.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-5 text-primary" />
              <CardTitle className="mt-2">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
