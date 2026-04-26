import { ComingSoon } from "@/components/admin/coming-soon";

export default function SettingsPlaceholder() {
  return (
    <ComingSoon
      title="Настройки клуба"
      description="Контактные данные, лого, обложка, расписание, приглашения админов."
      bullets={[
        "Редактирование названия, адреса, телефона, графика",
        "Загрузка лого и обложки (Supabase Storage)",
        "Приглашение админов по email с одноразовым токеном",
        "Кнопка «Подключить Telegram» для дублирования уведомлений",
        "Реализуется в Спринте 2",
      ]}
    />
  );
}
