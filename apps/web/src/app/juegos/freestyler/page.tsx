import type { Metadata } from "next";
import FreestylerDailyClient from "./FreestylerDailyClient";

export const metadata: Metadata = {
  title: "Freestyler del día | Freestyle Arena",
  description: "Adivina el freestyler diario en ocho intentos usando pistas de su trayectoria.",
};

export default function FreestylerDailyPage() {
  return <FreestylerDailyClient />;
}
