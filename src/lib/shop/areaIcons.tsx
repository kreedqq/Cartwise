import { FlaskConical, Package, ShoppingBag, Store, Users, Wrench, Boxes, Beaker } from "lucide-react";

export const AREA_ICON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "store", label: "Shop" },
  { key: "users", label: "Group Buy" },
  { key: "package", label: "Paket" },
  { key: "flask", label: "Labor" },
  { key: "beaker", label: "Beaker" },
  { key: "boxes", label: "Kartons" },
  { key: "wrench", label: "Zubehör" },
  { key: "bag", label: "Tasche" },
];

export function AreaGlyph({ iconKey, className }: { iconKey?: string | null; className?: string }) {
  const cls = className ?? "h-5 w-5";
  switch (iconKey) {
    case "users":
      return <Users className={cls} />;
    case "package":
      return <Package className={cls} />;
    case "flask":
      return <FlaskConical className={cls} />;
    case "beaker":
      return <Beaker className={cls} />;
    case "boxes":
      return <Boxes className={cls} />;
    case "wrench":
      return <Wrench className={cls} />;
    case "bag":
      return <ShoppingBag className={cls} />;
    default:
      return <Store className={cls} />;
  }
}
