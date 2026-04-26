import { ComingSoon } from "@/components/admin/coming-soon";

export default function ZonesPlaceholder() {
  return (
    <ComingSoon
      title="Зоны и тарифы"
      description="Создавай зоны (VIP / Bootcamp / General), задавай цвет на карте и стоимость в час."
      bullets={[
        "Drag-n-drop порядок зон",
        "Цветовой пикер для маркировки на карте",
        "Цена в час — целое число тенге, без копеек",
        "Привязка зоны к каждому ПК через выпадающий список",
        "Реализуется в Спринте 2 (следующий деплой)",
      ]}
    />
  );
}
