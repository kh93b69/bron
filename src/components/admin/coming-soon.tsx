import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1.5">
        <Badge variant="brand" className="w-fit">
          <Sparkles className="h-3 w-3" /> В разработке
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{description}</p>
      </header>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Что будет
          </h3>
          <ul className="flex flex-col gap-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-400)]" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
