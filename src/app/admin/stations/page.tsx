import { ComingSoon } from "@/components/admin/coming-soon";

export default function StationsPlaceholder() {
  return (
    <ComingSoon
      title="ПК"
      description="Управление компьютерами клуба: имена, спецификации, статус (активен / на обслуживании)."
      bullets={[
        "Таблица с фильтром по зоне и статусу",
        "Инлайн-редактирование характеристик (CPU / GPU / RAM / монитор)",
        "Bulk-операции: пометить N ПК как maintenance в один клик",
        "Импорт списка из CSV (для крупных клубов)",
        "Реализуется в Спринте 2",
      ]}
    />
  );
}
