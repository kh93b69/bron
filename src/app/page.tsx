import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Gauge,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, var(--color-brand-500), transparent 70%)",
        }}
      />

      <div className="mx-auto flex max-w-6xl flex-col px-4 sm:px-6">
        {/* nav */}
        <nav className="flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
            >
              Войти
            </Link>
            <Link href="/login">
              <Button size="sm">
                Подключить клуб
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </nav>

        {/* hero */}
        <section className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          <Badge variant="brand" className="mb-6 px-3 py-1">
            <Sparkles className="h-3 w-3" /> SaaS для кибер-арен
          </Badge>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Бронь ПК <br />
            <span className="gradient-text">за 30 секунд</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[var(--color-fg-muted)] sm:text-lg">
            Геймер открывает ссылку из инсты клуба → видит живую карту зала → забирает место.
            Без переписок и звонков. Админ освобождает рецепцию для гостей, а не для WhatsApp.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/c/test-demo">
              <Button size="lg">
                Демо клуба
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Я владелец клуба
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
            Free тариф навсегда · без карты · 5 минут на запуск
          </p>
        </section>

        {/* features */}
        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Zap className="h-5 w-5" />}
            title="Мгновенно"
            text="Email-OTP подтверждение. Без регистрации, без приложения. PWA устанавливается на главный экран в один тап."
          />
          <Feature
            icon={<MapPin className="h-5 w-5" />}
            title="Живая карта зала"
            text="Виден каждый ПК с характеристиками. Зелёный — свободен, красный — занят. Realtime-обновление без перезагрузки."
          />
          <Feature
            icon={<Users className="h-5 w-5" />}
            title="Группы и пракки"
            text="5 соседних мест для команды одной броней. Атомарно: либо все, либо никто. Идеально для тренировок."
          />
          <Feature
            icon={<CalendarClock className="h-5 w-5" />}
            title="Today-board"
            text="Полноэкранная панель для рецепции. Звуковое уведомление о новой брони, check-in в один тап."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Защита от no-show"
            text="Рейтинг клиента и автобан после двух пропусков. На Pro — депозит через Kaspi/Freedom."
          />
          <Feature
            icon={<Gauge className="h-5 w-5" />}
            title="Аналитика загрузки"
            text="Heatmap по часам, выручка по дням, топ-ПК. Понятно, какое железо обновлять, какие часы продвигать."
          />
        </section>

        {/* how it works */}
        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-3">Для геймера</Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                <Smartphone className="mr-2 inline h-7 w-7 text-[var(--color-brand-400)]" />
                Один клик из инсты — кресло твоё
              </h2>
              <ol className="mt-6 space-y-4">
                <Step n={1} text="Тап по ссылке в bio клуба" />
                <Step n={2} text="Карта зала, выбор ПК и времени" />
                <Step n={3} text="Email + 6-значный код = подтверждение" />
                <Step n={4} text="QR-код для админа на ресепшене" />
              </ol>
            </div>
            <div>
              <Badge variant="outline" className="mb-3">Для владельца</Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                <Clock className="mr-2 inline h-7 w-7 text-[var(--color-brand-400)]" />
                Минус 80% переписок, плюс 15–25% броней
              </h2>
              <ol className="mt-6 space-y-4">
                <Step n={1} text="Регистрация и онбординг — 2 минуты" />
                <Step n={2} text="Рисуем карту зала, ставим зоны и тарифы" />
                <Step n={3} text="Ссылку — в bio Instagram" />
                <Step n={4} text="Админ работает с панели на планшете" />
              </ol>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="my-20 flex flex-col items-center gap-4 text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Подключи свой клуб <span className="gradient-text">сегодня</span>
          </h2>
          <p className="max-w-xl text-[var(--color-fg-muted)]">
            5 минут — и геймеры из инсты бронируют ПК сами. Никаких карт, никаких контрактов.
          </p>
          <Link href="/login" className="mt-4">
            <Button size="lg">
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>

        <footer className="border-t border-[var(--color-border)] py-8 text-sm text-[var(--color-fg-subtle)]">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <Logo />
            <span>© {new Date().getFullYear()} CyberBook · MVP</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 transition hover:border-[var(--color-border-strong)]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{text}</p>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-500)]/20 text-xs font-semibold text-[var(--color-brand-300)]">
        {n}
      </span>
      <span className="pt-0.5 text-sm leading-relaxed text-[var(--color-fg)]">{text}</span>
    </li>
  );
}
