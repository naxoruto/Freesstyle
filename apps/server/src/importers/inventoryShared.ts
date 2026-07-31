import { normalizeAlias } from "../catalog/normalizeAlias";

export const COUNTRY_PATTERNS: Array<[RegExp, string]> = [
  [/\bargentina\b/i, "AR"], [/\bchile\b/i, "CL"], [/\bcolombia\b/i, "CO"],
  [/\bm[eé]xico\b/i, "MX"], [/\bespa[nñ]a\b/i, "ES"], [/\bper[uú]\b/i, "PE"],
  [/\bvenezuela\b/i, "VE"], [/\brep[uú]blica dominicana\b/i, "DO"], [/\buruguay\b/i, "UY"],
  [/\bpanam[aá]\b/i, "PA"], [/\bcosta rica\b/i, "CR"], [/\bguatemala\b/i, "GT"],
  [/\bpuerto rico\b/i, "PR"], [/\bbolivia\b/i, "BO"], [/\becuador\b/i, "EC"],
  [/\bparaguay\b/i, "PY"], [/\bel salvador\b/i, "SV"], [/\bhonduras\b/i, "HN"],
  [/\bcuba\b/i, "CU"], [/\bestados unidos\b/i, "US"],
];

export const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

export function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function countryCodeFromText(text: string) {
  return COUNTRY_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function parseSpanishDate(text: string) {
  const match = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(text);
  if (!match) return { birthDate: null, birthYear: undefined };
  const month = MONTHS[normalizeAlias(match[2])];
  if (!month) return { birthDate: null, birthYear: Number(match[3]) };
  return { birthDate: new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1]))), birthYear: Number(match[3]) };
}

export function classifyWin(label: string) {
  const normalized = normalizeAlias(label);
  if (/sub campe|semifinal/.test(normalized)) return { category: "RUNNER_UP", countsForDaily: false };
  if (/regional|ultima oportunidad/.test(normalized)) return { category: "REGIONAL", countsForDaily: false };
  if (/exhibici|5 vidas|plaza/.test(normalized)) return { category: "EXHIBITION", countsForDaily: false };
  if (/fms/.test(normalized)) return { category: /internacional|world series/.test(normalized) ? "LEAGUE_INTERNATIONAL" : "LEAGUE", countsForDaily: true };
  if (/red bull/.test(normalized)) return { category: /internacional|mundial/.test(normalized) ? "MAJOR_INTERNATIONAL" : "MAJOR_NATIONAL", countsForDaily: true };
  if (/internacional|final/.test(normalized)) return { category: "OTHER_MAJOR", countsForDaily: true };
  return { category: "OTHER", countsForDaily: false };
}

export function yearFromText(text: string) {
  const year = /\b(19\d{2}|20\d{2})\b/.exec(text)?.[1];
  return year ? Number(year) : null;
}
