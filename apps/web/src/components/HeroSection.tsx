"use client";
import React from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import bgImg from "@/assets/background.png";
import mcLeftImg from "@/assets/mc_left.png";
import mcRightImg from "@/assets/mc_right.png";

type Hover = "none" | "left" | "right";

export default function HeroSection({
  onJoin,
  onCreate,
}: {
  onJoin: () => void;
  onCreate: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Hover>("none");

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero-root">
      {/* Background image + dark vignette */}
      <div className="hero-bg">
        <Image
          src={bgImg}
          alt=""
          fill
          priority
          style={{ objectFit: "cover", objectPosition: "center 25%" }}
        />
        <div className="hero-bg-vignette" />
      </div>

      {/* Particles */}
      <div className="hero-particles" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      {/* Center title */}
      <div className={`hero-title${ready ? " hero-title--in" : ""}`}>
        <h1 className="font-battle text-glow">
          {"FREESTYLE".split("").map((char, i) => (
            <span key={i} className="hero-letter" style={{ "--i": i } as React.CSSProperties}>{char}</span>
          ))}
          <br />
          {"ARENA".split("").map((char, i) => (
            <span key={i} className="hero-letter" style={{ "--i": i + 10 } as React.CSSProperties}>{char}</span>
          ))}
        </h1>
<div className="hero-vs">VS</div>
      </div>

      {/* Left MC — Unirse */}
      <button
        className={[
          "mc-side mc-left",
          ready ? "mc--in" : "",
          hover === "left" ? "mc--hover" : "",
          hover === "right" ? "mc--dim" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => setHover("left")}
        onMouseLeave={() => setHover("none")}
        onClick={() => { setHover("none"); onJoin(); }}
        aria-label="Unirse a batalla"
      >
        {/* Spotlight behind MC so mix-blend-mode:multiply has luminosity to blend with */}
        <div className="mc-spotlight mc-spotlight--red" />
        <div className="mc-img-wrap">
          <Image
            src={mcLeftImg}
            alt=""
            fill
            style={{ objectFit: "cover", objectPosition: "65% bottom" }}
          />
        </div>
        <div className="mc-cta">
          <span className="mc-cta-label">UNIRSE</span>
          <span className="mc-cta-sub">Entrar con código de sala</span>
          <span className="mc-cta-btn">→ ENTRAR</span>
        </div>
      </button>

      {/* Right MC — Crear Sala */}
      <button
        className={[
          "mc-side mc-right",
          ready ? "mc--in" : "",
          hover === "right" ? "mc--hover" : "",
          hover === "left" ? "mc--dim" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => setHover("right")}
        onMouseLeave={() => setHover("none")}
        onClick={() => { setHover("none"); onCreate(); }}
        aria-label="Crear sala de batalla"
      >
        <div className="mc-spotlight mc-spotlight--blue" />
        <div className="mc-img-wrap">
          <Image
            src={mcRightImg}
            alt=""
            fill
            style={{ objectFit: "cover", objectPosition: "0% bottom" }}
          />
        </div>
        <div className="mc-cta">
          <span className="mc-cta-label">CREAR SALA</span>
          <span className="mc-cta-sub">Organiza una nueva batalla</span>
          <span className="mc-cta-btn">→ CREAR</span>
        </div>
      </button>
    </section>
  );
}
