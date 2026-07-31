import type { Metadata } from "next";
import InventoryClient from "./InventoryClient";

export const metadata: Metadata = {
  title: "Inventario externo | Freestyle Arena",
  description: "Revisión de perfiles externos importados desde Fandom y FreestyleStats.",
};

export default function InventoryPage() {
  return <InventoryClient />;
}
