import Link from "next/link";
import { ArrowRight, Clock, MapPin, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-xl font-semibold tracking-tight">CyberBook</span>
        <Link
          href="/login"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Войти
        </Link>
      </header>

      <section className="flex flex-col gap-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Бронируй место <br />
          в кибер-клубе <br />
          за <span className="text-[var(--color-brand-500)]">30 секунд</span>.
        </h1>
        <p className="max-w-2xl text-lg text-[color:var(--muted-foreground)]">
          Открываешь ссылку клуба в инсте → видишь живую карту зала → выбираешь ПК → получаешь QR.
          Без переписок с админом.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/c/demo"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-500)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-600)]"
          >
            Посмотреть демо клуба
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/signup/owner"
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-muted"
          >
            Я владелец клуба
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <Feature icon={<Zap className="h-5 w-5" />} title="Мгновенно">
          Без звонков и ожидания в WhatsApp. Код подтверждения приходит в email.
        </Feature>
        <Feature icon={<MapPin className="h-5 w-5" />} title="Живая карта">
          Видишь, какие ПК свободны прямо сейчас. Выбираешь VIP / Bootcamp / General.
        </Feature>
        <Feature icon={<Clock className="h-5 w-5" />} title="Для команд">
          Забронируй 5 соседних мест одним действием для тренировок.
        </Feature>
      </section>

      <footer className="mt-auto text-sm text-[color:var(--muted-foreground)]">
        © {new Date().getFullYear()} CyberBook · MVP
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-brand-100)] text-[var(--color-brand-700)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-[color:var(--muted-foreground)]">{children}</p>
    </div>
  );
}
