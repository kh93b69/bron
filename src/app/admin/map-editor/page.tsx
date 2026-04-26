import { ComingSoon } from "@/components/admin/coming-soon";

export default function MapEditorPlaceholder() {
  return (
    <ComingSoon
      title="Редактор карты зала"
      description="Drag-n-drop иконок ПК на сетке. Размещай VIP / Bootcamp / General как у себя в зале."
      bullets={[
        "Сетка 4×4 — 40×40, расстановка ПК мышью или тапами",
        "Стены / перегородки / подписи (БАР, ВХОД, ТУАЛЕТ)",
        "Превью «как видит геймер» в один клик",
        "Автосохранение в localStorage + версионирование",
        "Реализуется в Спринте 3",
      ]}
    />
  );
}
