export type VerifiedTitle = [competition: "fms" | "red-bull-batalla", label: string];

export interface VerifiedProfile {
  alias: string;
  fmsParticipant?: boolean;
  redBullInternational: boolean;
  realName?: string;
  birthYear?: number | null;
  clearBirthDate?: boolean;
  sources?: Array<{ name: string; url: string }>;
  titles: VerifiedTitle[];
}

export const VERIFIED_SOURCES = {
  fms: {
    name: "Archivo oficial de FMS",
    url: "https://fms.tv/",
  },
  "red-bull-batalla": {
    name: "Archivo oficial de Red Bull Batalla",
    url: "https://www.redbull.com/int-es/event-series/red-bull-batalla",
  },
} as const;

export const VERIFIED_PROFILES: VerifiedProfile[] = [
  {
    alias: "Wos",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Argentina 2018"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2017"],
      ["red-bull-batalla", "Red Bull Internacional 2018"],
    ],
  },
  {
    alias: "Acru",
    fmsParticipant: false,
    redBullInternational: false,
    realName: "Agustín Cruz",
    birthYear: null,
    clearBirthDate: true,
    sources: [
      { name: "Perfil oficial de Acru en Red Bull", url: "https://www.redbull.com/ar-es/artist/acru" },
      {
        name: "Red Bull Argentina 2020: Acru vs Tiago",
        url: "https://www.redbull.com/ar-es/videos/acru-vs-tiago---octavos-%7C-red-bull-argentina-2020",
      },
    ],
    titles: [],
  },
  {
    alias: "Duki",
    fmsParticipant: false,
    redBullInternational: false,
    realName: "Mauro Ezequiel Lombardo",
    birthYear: 1996,
    sources: [
      {
        name: "Infobae: Duki y El Quinto Escalón",
        url: "https://www.infobae.com/teleshow/2023/09/09/duki-fue-declarado-personalidad-destacada-de-la-cultura-portena-los-motivos/",
      },
      {
        name: "El País: perfil de Duki",
        url: "https://elpais.com/cultura/2023-08-27/duki-el-chico-que-llenara-el-bernabeu-mi-musica-es-un-grito-que-da-fuerza-a-la-gente-humilde.html",
      },
    ],
    titles: [],
  },
  {
    alias: "Ecko",
    fmsParticipant: false,
    redBullInternational: false,
    realName: "Ignacio Matías Spallatti",
    birthYear: 1999,
    clearBirthDate: true,
    sources: [
      { name: "CMTV: biografía de Ecko", url: "https://www.cmtv.com.ar/biografia/show.php?bnid=2533&banda=Ecko" },
      {
        name: "Red Bull Argentina 2017: Ecko vs Dozer",
        url: "https://www.redbull.com/ar-es/videos/ecko-vs-dozer-3er-puesto-final-nacional-argentina-2017",
      },
    ],
    titles: [],
  },
  {
    alias: "Lit Killah",
    fmsParticipant: false,
    redBullInternational: false,
    realName: "Mauro Román Monzón",
    birthYear: 1999,
    sources: [
      {
        name: "TN: perfil de Lit Killah",
        url: "https://tn.com.ar/deportes/2026/07/25/quien-es-lit-killah-el-cantante-que-peleara-en-la-velada-del-ano-6-de-ibai-llanos/",
      },
      {
        name: "LOS40: perfil de Lit Killah",
        url: "https://los40.com/2026/07/25/quien-es-lit-killah-el-fenomeno-argentino-que-conquisto-el-trap-y-ahora-se-sube-al-ring-de-la-velada-del-ano/",
      },
    ],
    titles: [],
  },
  {
    alias: "RepliK",
    fmsParticipant: true,
    redBullInternational: false,
    realName: "Manuel Vainstein Biquard",
    birthYear: 2000,
    sources: [
      {
        name: "Infobae: perfil de RepliK",
        url: "https://www.infobae.com/teleshow/infoshow/2020/04/14/asi-suena-raven-el-nuevo-lanzamiento-del-rapero-replik/",
      },
      { name: "Perfil oficial de RepliK en FMS", url: "https://fms.tv/mcs/replik/" },
    ],
    titles: [],
  },
  {
    alias: "Trueno",
    fmsParticipant: true,
    redBullInternational: true,
    realName: "Mateo Palacios Corazzina",
    birthYear: 2002,
    sources: [
      {
        name: "Red Bull: campeonato argentino de Trueno",
        url: "https://www.redbull.com/ar-es/trueno-vivio-su-gran-noche-y-se-consagro-campeon-argentino",
      },
      { name: "Red Bull: perfil de Trueno", url: "https://www.redbull.com/ar-es/cinco-cosas-que-debes-saber-sobre-trueno" },
    ],
    titles: [
      ["fms", "FMS Argentina 2019"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2019"],
    ],
  },
  {
    alias: "Acertijo",
    fmsParticipant: true,
    redBullInternational: true,
    realName: "Martín García Fuentes",
    birthYear: null,
    clearBirthDate: true,
    sources: [
      {
        name: "Universidad de Chile: perfil de Acertijo",
        url: "https://uchile.cl/noticias/210318/la-madurez-de-acertijo-el-campeon-nacional-de-freestyle",
      },
      {
        name: "Red Bull: Acertijo campeón de Chile 2020",
        url: "https://www.redbull.com/co-es/acertijo-campeon-batalla-chile-2020",
      },
    ],
    titles: [["red-bull-batalla", "Red Bull Nacional Chile 2020"]],
  },
  {
    alias: "Metalingüística",
    fmsParticipant: true,
    redBullInternational: false,
    realName: "Diego Alejandro Quilodrán Espejo",
    birthYear: 2001,
    sources: [
      {
        name: "La Tercera: perfil de Metalingüística",
        url: "https://www.latercera.com/culto/2020/10/12/metalinguistica-el-salto-de-la-figura-del-freestyle-chileno/",
      },
      {
        name: "Urban Roosters: perfil de Metalingüística",
        url: "https://urbanroosters.news/metalinguistica-mc-freestyle-fms-chile/",
      },
    ],
    titles: [],
  },
  {
    alias: "Papo",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Argentina 2022"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2016"],
    ],
  },
  {
    alias: "Stuart",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Argentina 2020/21"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2024"],
    ],
  },
  { alias: "Klan", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional Argentina 2021"]] },
  {
    alias: "Dtoke",
    redBullInternational: true,
    titles: [
      ["red-bull-batalla", "Red Bull Nacional Argentina 2013"],
      ["red-bull-batalla", "Red Bull Internacional 2013"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2015"],
    ],
  },
  {
    alias: "Mecha",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Argentina 2024/25"],
      ["red-bull-batalla", "Red Bull Nacional Argentina 2022"],
    ],
  },
  { alias: "Nacho", redBullInternational: false, titles: [] },
  {
    alias: "Larrix",
    redBullInternational: false,
    titles: [
      ["fms", "FMS Argentina 2023"],
      ["fms", "FMS Internacional 2023/24"],
    ],
  },
  {
    alias: "Chuty",
    redBullInternational: true,
    titles: [
      ["fms", "FMS España 2017"],
      ["fms", "FMS España 2018"],
      ["fms", "FMS España 2019"],
      ["fms", "FMS Internacional 2022/23"],
      ["fms", "FMS España 2024/25"],
      ["fms", "FMS World Series 2024"],
      ["red-bull-batalla", "Red Bull Nacional España 2013"],
      ["red-bull-batalla", "Red Bull Nacional España 2017"],
      ["red-bull-batalla", "Red Bull Nacional España 2023"],
      ["red-bull-batalla", "Red Bull Internacional 2023"],
      ["red-bull-batalla", "Red Bull Internacional 2024 (título compartido)"],
    ],
  },
  {
    alias: "Gazir",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Internacional 2020/21"],
      ["fms", "FMS España 2022"],
      ["fms", "FMS España 2023"],
      ["red-bull-batalla", "Red Bull Nacional España 2021"],
      ["red-bull-batalla", "Red Bull Nacional España 2024"],
      ["red-bull-batalla", "Red Bull Internacional 2024 (título compartido)"],
    ],
  },
  {
    alias: "Skone",
    redBullInternational: true,
    titles: [
      ["red-bull-batalla", "Red Bull Nacional España 2016"],
      ["red-bull-batalla", "Red Bull Internacional 2016"],
      ["red-bull-batalla", "Red Bull Nacional España 2020"],
    ],
  },
  {
    alias: "Bnet",
    redBullInternational: true,
    titles: [
      ["fms", "FMS España 2020/21"],
      ["red-bull-batalla", "Red Bull Nacional España 2018"],
      ["red-bull-batalla", "Red Bull Internacional 2019"],
    ],
  },
  { alias: "Blon", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional España 2022"]] },
  { alias: "Sweet Pain", redBullInternational: false, titles: [] },
  { alias: "Zasko", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional España 2019"]] },
  {
    alias: "Aczino",
    redBullInternational: true,
    titles: [
      ["fms", "FMS México 2019"],
      ["fms", "FMS Internacional 2019/20"],
      ["fms", "FMS México 2022"],
      ["red-bull-batalla", "Red Bull Nacional Colombia 2012"],
      ["red-bull-batalla", "Red Bull Nacional México 2014"],
      ["red-bull-batalla", "Red Bull Nacional México 2015"],
      ["red-bull-batalla", "Red Bull Nacional México 2017"],
      ["red-bull-batalla", "Red Bull Internacional 2017"],
      ["red-bull-batalla", "Red Bull Internacional 2021"],
      ["red-bull-batalla", "Red Bull Internacional 2022"],
    ],
  },
  {
    alias: "Rapder",
    redBullInternational: true,
    titles: [
      ["fms", "FMS México 2020/21"],
      ["fms", "FMS México 2024/25"],
      ["red-bull-batalla", "Red Bull Nacional México 2018"],
      ["red-bull-batalla", "Red Bull Internacional 2020"],
    ],
  },
  { alias: "Jony Beltrán", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional México 2013"]] },
  { alias: "RC", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional México 2016"]] },
  {
    alias: "Lobo Estepario",
    redBullInternational: true,
    titles: [
      ["fms", "FMS México 2023/24"],
      ["red-bull-batalla", "Red Bull Nacional México 2019"],
    ],
  },
  {
    alias: "Nitro",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Chile 2020/21"],
      ["fms", "FMS Chile 2022"],
      ["red-bull-batalla", "Red Bull Nacional Chile 2020"],
    ],
  },
  {
    alias: "Teorema",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Chile 2019"],
      ["red-bull-batalla", "Red Bull Nacional Chile 2019"],
    ],
  },
  { alias: "Kaiser", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional Chile 2014"]] },
  {
    alias: "El Menor",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Chile 2023/24"],
      ["fms", "FMS Chile 2024/25"],
      ["red-bull-batalla", "Red Bull Nacional Chile 2024"],
    ],
  },
  { alias: "Jokker", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional Chile 2022"]] },
  {
    alias: "Jaze",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Perú 2020/21"],
      ["fms", "FMS Perú 2022"],
      ["red-bull-batalla", "Red Bull Nacional Perú 2018"],
    ],
  },
  { alias: "Nekroos", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional Perú 2020"]] },
  {
    alias: "Stick",
    redBullInternational: true,
    titles: [
      ["red-bull-batalla", "Red Bull Nacional Perú 2013"],
      ["red-bull-batalla", "Red Bull Nacional Perú 2019"],
    ],
  },
  {
    alias: "Valles-T",
    redBullInternational: true,
    titles: [
      ["fms", "FMS Colombia 2022"],
      ["fms", "FMS Colombia 2023"],
      ["red-bull-batalla", "Red Bull Nacional Colombia 2016"],
      ["red-bull-batalla", "Red Bull Nacional Colombia 2018"],
    ],
  },
  { alias: "Marithea", redBullInternational: true, titles: [["red-bull-batalla", "Red Bull Nacional Colombia 2021"]] },
  { alias: "Alek", fmsParticipant: true, redBullInternational: false, birthYear: 2003, titles: [] },
  {
    alias: "Arkano",
    fmsParticipant: true,
    redBullInternational: true,
    birthYear: 1994,
    titles: [
      ["red-bull-batalla", "Red Bull Nacional España 2009"],
      ["red-bull-batalla", "Red Bull Internacional 2015"],
    ],
  },
  { alias: "Azuky", fmsParticipant: true, redBullInternational: false, birthYear: 2005, titles: [] },
  { alias: "Barón", fmsParticipant: true, redBullInternational: false, birthYear: 1998, titles: [] },
  { alias: "CTZ", fmsParticipant: true, redBullInternational: false, birthYear: 2003, titles: [] },
  { alias: "Dani", fmsParticipant: true, redBullInternational: false, birthYear: 1999, titles: [] },
  { alias: "Drose", fmsParticipant: true, redBullInternational: false, birthYear: 1999, titles: [] },
  { alias: "Exe", fmsParticipant: true, redBullInternational: false, birthYear: 2002, titles: [] },
  {
    alias: "Filósofo",
    fmsParticipant: true,
    redBullInternational: true,
    birthYear: 1999,
    titles: [["red-bull-batalla", "Red Bull Nacional Colombia 2017"]],
  },
  { alias: "KG", fmsParticipant: true, redBullInternational: true, birthYear: 2002, titles: [] },
  { alias: "Kodigo", fmsParticipant: true, redBullInternational: true, birthYear: 1995, titles: [] },
  { alias: "Lokillo", fmsParticipant: true, redBullInternational: false, birthYear: 1987, titles: [] },
  { alias: "MP", fmsParticipant: true, redBullInternational: false, birthYear: 1999, titles: [] },
  {
    alias: "Mnak",
    fmsParticipant: true,
    redBullInternational: true,
    birthYear: 1997,
    titles: [["red-bull-batalla", "Red Bull Nacional España 2020"]],
  },
  {
    alias: "Pepe Grillo",
    fmsParticipant: true,
    redBullInternational: true,
    birthYear: 1998,
    titles: [["red-bull-batalla", "Red Bull Nacional Chile 2017"]],
  },
];
