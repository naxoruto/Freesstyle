import type { Metadata } from "next";
import CatalogClient from "./CatalogClient";

export const metadata: Metadata = {
  title: "Catálogo de freestylers | Freestyle Arena",
  description: "Freestylers, países y estado de verificación del catálogo de Freestyle Arena.",
};

export default function CatalogPage() {
  return <CatalogClient />;
}
