import { Separator } from "@/components/ui/separator";

const FAQS = [
  {
    question: "Is er een gratis plan?",
    answer:
      "Ja. Het Starter-plan is gratis en blijft dat — perfect om te starten met één portefeuille en tot 10 posities. Je upgrade pas wanneer je meer nodig hebt.",
  },
  {
    question: "Kan ik op elk moment van plan wisselen?",
    answer:
      "Zeker. Upgraden of downgraden kan op elk moment; je betaalt enkel voor de periode die je effectief gebruikt.",
  },
  {
    question: "In welke munten werkt Canopy?",
    answer:
      "Je stelt een basismunt in bij het aanmaken van je account (standaard EUR). Posities in andere munten worden automatisch omgerekend naar je basismunt.",
  },
  {
    question: "Kan ik overstappen vanuit een spreadsheet?",
    answer:
      "Ja, via CSV-import breng je je bestaande transacties in enkele klikken over, zonder alles handmatig te moeten invoeren.",
  },
  {
    question: "Hoe werkt de uitnodiging voor signup?",
    answer:
      "Canopy is momenteel in beta en toegang verloopt op uitnodiging: je e-mailadres moet vooraf geautoriseerd zijn voordat je een account kan aanmaken.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Veelgestelde vragen</h2>
      </div>
      <div className="mt-10 flex flex-col">
        {FAQS.map((faq, index) => (
          <div key={faq.question}>
            {index > 0 && <Separator />}
            <div className="py-5">
              <h3 className="font-medium">{faq.question}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
