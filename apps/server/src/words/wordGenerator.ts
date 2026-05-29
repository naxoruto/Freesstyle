import type { Word, WordCategory, WordDifficulty } from "@freestyle/shared";

// Banco de palabras organizado por categoría y dificultad
const wordBank: Record<WordCategory, Record<WordDifficulty, string[]>> = {
  animales: {
    facil: ["perro", "gato", "pez", "oso", "pato", "rana", "toro", "gallo", "lobo", "oveja"],
    medio: ["jirafa", "cocodrilo", "pingüino", "canguro", "hipopótamo", "orangután", "escorpión", "pantera", "delfín", "murciélago"],
    dificil: ["ornitorrinco", "axolote", "pangolín", "narval", "okapi", "quetzal", "ajolote", "equidna", "lemur", "capibara"],
  },
  objetos: {
    facil: ["mesa", "silla", "libro", "reloj", "llave", "vaso", "cama", "puerta", "lámpara", "espejo"],
    medio: ["termómetro", "telescopio", "microscopio", "acordeón", "brújula", "tornillo", "paraguas", "candado", "ventilador", "calendario"],
    dificil: ["astrolabio", "caleidoscopio", "pantógrafo", "sextante", "telégrafo", "fonógrafo", "alambique", "periscopio", "giroscopio", "criptex"],
  },
  famosos: {
    facil: ["Messi", "Shakira", "Bad Bunny", "Dwayne Johnson", "Taylor Swift", "Elon Musk", "Mr. Beast", "Ronaldo", "Karol G", "Will Smith"],
    medio: ["Frida Kahlo", "Nikola Tesla", "Marie Curie", "Stephen Hawking", "Bruce Lee", "Bob Marley", "Da Vinci", "Cleopatra", "Napoleón", "Gandhi"],
    dificil: ["Dostoyevski", "Nikola Tesla", "Ada Lovelace", "Sócrates", "Borges", "Hipatia", "Copérnico", "Sun Tzu", "Arquímedes", "Nietzsche"],
  },
  abstractos: {
    facil: ["amor", "miedo", "suerte", "paz", "odio", "risa", "duda", "fe", "alma", "luz"],
    medio: ["nostalgia", "destino", "infinito", "caos", "melancolía", "ironía", "empatía", "ansiedad", "orgullo", "sabiduría"],
    dificil: ["nihilismo", "entropía", "sinestesia", "existencialismo", "estoicismo", "metafísica", "dialéctica", "fenomenología", "paradigma", "catarsis"],
  },
  acciones: {
    facil: ["correr", "saltar", "nadar", "volar", "cantar", "bailar", "comer", "dormir", "gritar", "llorar"],
    medio: ["meditar", "susurrar", "derretir", "descifrar", "persuadir", "naufragar", "esculpir", "murmurar", "titubear", "reverdecer"],
    dificil: ["transmutar", "yuxtaponer", "catalizar", "perpetrar", "exacerbar", "disgregar", "inmiscuir", "subyugar", "trastocar", "escaramuzar"],
  },
  lugares: {
    facil: ["playa", "montaña", "bosque", "ciudad", "hospital", "escuela", "iglesia", "cárcel", "mercado", "teatro"],
    medio: ["acantilado", "pantano", "volcán", "glaciar", "necrópolis", "catacumba", "alcantarilla", "observatorio", "laberinto", "santuario"],
    dificil: ["cenote", "fiordo", "estepa", "tundra", "zénit", "archipiélago", "subsuelo", "inframundo", "páramo", "cripta"],
  },
  comida: {
    facil: ["pizza", "hamburguesa", "taco", "sushi", "helado", "pan", "queso", "huevo", "arroz", "pollo"],
    medio: ["lasaña", "paella", "croissant", "guacamole", "hummus", "tiramisú", "gazpacho", "carpaccio", "chimichurri", "mole"],
    dificil: ["bouillabaisse", "ratatouille", "haggis", "ceviche", "pho", "kimchi", "baklava", "couscous", "sashimi", "dim sum"],
  },
  tecnologia: {
    facil: ["wifi", "robot", "drone", "app", "selfie", "emoji", "meme", "tiktok", "gamer", "stream"],
    medio: ["algoritmo", "blockchain", "nanotecnología", "biotecnología", "criptografía", "holograma", "mainframe", "satélite", "placa base", "fibra óptica"],
    dificil: ["computación cuántica", "singularidad", "transhumanismo", "criptomoneda", "tokenómica", "machine learning", "big data", "internet de las cosas", "realidad aumentada", "edge computing"],
  },
};

let idCounter = 0;

export function generateWord(
  category?: WordCategory,
  difficulty: WordDifficulty = "medio"
): Word {
  const categories: WordCategory[] = category
    ? [category]
    : (Object.keys(wordBank) as WordCategory[]);

  const chosenCategory = categories[Math.floor(Math.random() * categories.length)];
  const words = wordBank[chosenCategory]?.[difficulty] ?? wordBank[chosenCategory]?.medio ?? [];

  if (words.length === 0) {
    // Fallback
    return {
      id: `w-${++idCounter}`,
      text: "freestyle",
      category: "abstractos",
      difficulty: "facil",
    };
  }

  const text = words[Math.floor(Math.random() * words.length)];

  return {
    id: `w-${++idCounter}`,
    text,
    category: chosenCategory,
    difficulty,
  };
}

export function getCategories(): WordCategory[] {
  return Object.keys(wordBank) as WordCategory[];
}
