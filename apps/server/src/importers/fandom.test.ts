import { describe, expect, it } from "vitest";
import { isPlausibleBirthYear, parseFandomProfile } from "./fandom";

describe("parseFandomProfile", () => {
  it("extracts conservative facts from an artist infobox", () => {
    const profile = parseFandomProfile(`{{Infobox Artista
|nombre real = Mauricio Hernández González
|actividad = 2007 - Actualidad
|nacimiento = 2 de julio de 1991 {{edad|02|07|1991}}
|premios =
*[[FMS México 2019]]
*[[Red Bull Internacional 2021]]
*FMS Colombia 2025|sello=datos que no pertenecen al título}}
|instagram = example
}}{{Cita|texto FMS 2099 que no pertenece a la ficha}}`);

    expect(profile.realName).toBe("Mauricio Hernández González");
    expect(profile.origin).toBeUndefined();
    expect(profile.birthDate?.toISOString()).toBe("1991-07-02T00:00:00.000Z");
    expect(profile.birthYear).toBe(1991);
    expect(profile.activityYearCandidate).toBe(2007);
    expect(profile.titleCandidates).toEqual([
      "FMS México 2019",
      "Red Bull Internacional 2021",
      "FMS Colombia 2025",
    ]);
  });

  it("extracts origin from the infobox", () => {
    const profile = parseFandomProfile(`{{Infobox_Artista|origen = Puente Alto, Chile|tipo = [[Freestyler]]}}`);

    expect(profile.origin).toBe("Puente Alto, Chile");
    expect(profile.aliases).toEqual([]);
  });

  it("extracts alternate aliases without duplicating the primary alias", () => {
    const profile = parseFandomProfile(`{{Infobox_Artista|apodo = ARK, Smooth Arkano, Arkano}}`, "Arkano");

    expect(profile.aliases).toEqual(["ARK", "Smooth Arkano"]);
  });

  it("keeps partial birth years without inventing a date", () => {
    const profile = parseFandomProfile(`{{Infobox_Artista
|nacimiento = Córdoba, Argentina, 1999
}}`);

    expect(profile.birthDate).toBeUndefined();
    expect(profile.birthYear).toBe(1999);
  });

  it("reads pipe-delimited infoboxes written on one line", () => {
    const profile = parseFandomProfile(`{{Infobox_Artista|nombre artístico=Basek|imagen=Mc-basek.jpg|nombre_real=Francisco Miguel Ángel Mateluna Allendes|actividad=2008 - Actualidad|premios=<center></center>
*Red Bull Batalla de los Gallos Nacional Chile 2008
*Leyendas del Free: Primera Edición
*Red Bull Batalla de los Gallos Nacional Chile 2021|nacimiento=19 de Agosto de 1986}}`);

    expect(profile.realName).toBe("Francisco Miguel Ángel Mateluna Allendes");
    expect(profile.birthYear).toBe(1986);
    expect(profile.activityYearCandidate).toBe(2008);
    expect(profile.titleCandidates).toEqual([
      "Red Bull Batalla de los Gallos Nacional Chile 2008",
      "Red Bull Batalla de los Gallos Nacional Chile 2021",
    ]);
  });
});

describe("isPlausibleBirthYear", () => {
  it("rejects impossible candidate ages", () => {
    expect(isPlausibleBirthYear(1998, 2026)).toBe(true);
    expect(isPlausibleBirthYear(2022, 2026)).toBe(false);
    expect(isPlausibleBirthYear(1942, 2026)).toBe(false);
  });
});
