import { ComingSoon } from "@/components/admin/coming-soon";

export default function AnalyticsPlaceholder() {
  return (
    <ComingSoon
      title="Аналитика"
      description="Дашборд для владельцев: загрузка, выручка, поведение клиентов."
      bullets={[
        "Heatmap occupancy: часы × дни недели",
        "Revenue по дням, неделям, месяцам",
        "Топ-5 ПК по выручке + анти-топ (на обновление)",
        "Cohort retention: новые vs возвращающиеся гости",
        "Реализуется в Спринте 3",
      ]}
    />
  );
}
