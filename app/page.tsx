"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

// ── Our placeholder songs (just title + artist for now) ──────────────
const SONGS = [
  { title: "Neon Cassette",      artist: "The Bedroom Astronauts" },
  { title: "Sidewalk Disco",     artist: "Plum & the Pavement" },
  { title: "Slow Motion Sunday", artist: "Cassette Coast" },
  { title: "Bug in the System",  artist: "Static Bloom" },
  { title: "Brewed Too Strong",  artist: "The Overcaffeinated" },
  { title: "Midnight Mixtape",   artist: "Velvet Static" },
];

// A few playful colors we reuse everywhere
const C = {
  sun:      "#FFD23F",
  ink:      "#16131F",
  grape:    "#6C2BD9",
  pink:     "#FF2E88",
  softPink: "#FFA9D7",
  cyan:     "#00E5D1",
  tomato:   "#FF5436",
  cream:    "#FFF6E9",
};

// Pre-build the falling confetti + flower "rain" pieces (random positions/speeds)
const RAIN = Array.from({ length: 42 }).map((_, i) => {
  const isFlower = i % 3 === 0;
  return {
    id: i,
    isFlower,
    left: Math.round(Math.random() * 100),
    delay: +(Math.random() * 8).toFixed(2),
    duration: +(7 + Math.random() * 7).toFixed(2),
    size: isFlower ? 12 + Math.round(Math.random() * 6) : 6 + Math.round(Math.random() * 6),
    drift: Math.round(Math.random() * 60 - 30),
    color: [C.sun, C.pink, C.cyan, C.tomato, C.grape][i % 5],
  };
});

export default function BugsAndBrews() {
  // Which song is showing right now (null = nothing played yet)
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Load two characterful fonts: a chunky display face + a typewriter mono
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Pick a RANDOM song (never the same one twice in a row) and start spinning
  function discover() {
    let next = Math.floor(Math.random() * SONGS.length);
    while (current !== null && next === current && SONGS.length > 1) {
      next = Math.floor(Math.random() * SONGS.length);
    }
    setCurrent(next);
    setPlaying(true);
  }

  const song = current === null ? null : SONGS[current];

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* Falling confetti + flowers drifting down the background */}
      <div style={styles.rainLayer} aria-hidden="true">
        {RAIN.map((p) =>
          p.isFlower ? (
            <span
              key={p.id}
              className="rain-piece"
              style={{
                left: `${p.left}%`,
                fontSize: p.size,
                color: C.softPink,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ["--drift"]: `${p.drift}px`,
              } as CSSProperties}
            >
              ✿
            </span>
          ) : (
            <span
              key={p.id}
              className="rain-piece"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.6,
                background: p.color,
                borderRadius: 2,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ["--drift"]: `${p.drift}px`,
              } as CSSProperties}
            />
          )
        )}
      </div>

      {/* Decorative stickers floating in the corners */}
      <span style={{ ...styles.sticker, top: "8%",  left: "7%",  background: C.cyan,   transform: "rotate(-12deg)" }}>★</span>
      <span style={{ ...styles.sticker, top: "14%", right: "9%", background: C.tomato, transform: "rotate(10deg)" }}>♪</span>
      <span style={{ ...styles.sticker, bottom: "10%", left: "11%", background: C.pink, transform: "rotate(8deg)" }}>☕</span>
      <span style={{ ...styles.sticker, bottom: "16%", right: "8%", background: C.grape, color: C.cream, transform: "rotate(-9deg)" }}>✦</span>

      <main style={styles.stage}>
        {/* Header */}
        <h1 style={styles.logo}>Mixtape for cuties</h1>
        <p style={styles.tagline}>
          Press play. Meet your <span style={styles.taglineHi}>next favorite song.</span>
        </p>

        {/* ── THE CASSETTE (the centerpiece) ── */}
        <div className="cassette" style={styles.cassette}>
          {/* Label strip — re-keyed so it pops each time the song changes */}
          <div key={current ?? "idle"} className="label-pop" style={styles.label}>
            {song ? (
              <>
                <div style={styles.labelTitle}>{song.title}</div>
                <div style={styles.labelArtist}>by {song.artist}</div>
              </>
            ) : (
              <>
                <div style={styles.labelTitle}>▷ PRESS PLAY</div>
                <div style={styles.labelArtist}>your mixtape awaits</div>
              </>
            )}
          </div>

          {/* The two daisy reels + the tape window between them */}
          <div style={styles.reelRow}>
            <Reel spinning={playing} />
            <div style={styles.window}>
              <div style={styles.tape} />
              {/* tiny equalizer bars, only when playing */}
              <div style={styles.eq}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={playing ? "eq-bar" : ""}
                    style={{
                      ...styles.eqBar,
                      animationDelay: `${i * 0.12}s`,
                      height: playing ? undefined : 6,
                    }}
                  />
                ))}
              </div>
            </div>
            <Reel spinning={playing} />
          </div>

          <div style={styles.cassetteFoot}>
            bugsandbrews ⋆ home-brewed mixtape ⋆ TYPE II
          </div>
        </div>

        {/* ── THE BIG PLAY BUTTON ── */}
        <button className="play-btn" style={styles.play} onClick={discover}>
          <span style={styles.playIcon}>{current === null ? "▶" : "↻"}</span>
          {current === null ? "Play" : "Next track"}
        </button>

        <p style={styles.counter}>
          {current !== null ? `track ${current + 1} of ${SONGS.length}` : `${SONGS.length} tracks loaded`}
        </p>
      </main>
    </div>
  );
}

// A single daisy reel: white petals + sunny center, turning while idle and
// spinning faster while a track plays.
function Reel({ spinning }: { spinning: boolean }) {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" style={styles.reel}>
      <g
        className={spinning ? "reel-spin reel-spin-fast" : "reel-spin"}
        style={{ transformOrigin: "46px 46px" }}
      >
        {/* Daisy petals radiating from the center */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <ellipse
            key={deg}
            cx="46" cy="20" rx="7" ry="15"
            fill="#FFFFFF"
            stroke={C.ink}
            strokeWidth="3"
            transform={`rotate(${deg} 46 46)`}
          />
        ))}
        {/* Sunny daisy center */}
        <circle cx="46" cy="46" r="15" fill={C.sun} stroke={C.ink} strokeWidth="4" />
      </g>
    </svg>
  );
}

// ── Styles (kept as plain inline styles so it works no matter how your
//    Tailwind is configured — one less thing that can break) ──────────
const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: `radial-gradient(circle at 50% 28%, #EFE9FF 0%, #CDBCF2 65%)`,
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    color: C.ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    position: "relative",
    overflow: "hidden",
  },
  rainLayer: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 1,
  },
  sticker: {
    position: "absolute",
    width: 56, height: 56,
    display: "grid", placeItems: "center",
    fontSize: 26,
    borderRadius: "50%",
    border: `4px solid ${C.ink}`,
    boxShadow: `4px 4px 0 ${C.ink}`,
    color: C.ink,
    userSelect: "none",
  },
  stage: {
    width: "100%",
    maxWidth: 620,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    zIndex: 2,
  },
  logo: {
    fontSize: "clamp(42px, 9vw, 76px)",
    fontWeight: 800,
    lineHeight: 1,
    margin: "16px 0 0",
    letterSpacing: "-0.03em",
    textShadow: `4px 4px 0 ${C.pink}`,
    transform: "rotate(-2deg)",
  },
  tagline: { fontSize: "clamp(16px, 3.5vw, 20px)", margin: "14px 0 28px", fontWeight: 700 },
  taglineHi: { background: C.cyan, padding: "2px 8px", borderRadius: 8, border: `3px solid ${C.ink}` },

  cassette: {
    width: "100%",
    maxWidth: 460,
    background: C.grape,
    border: `5px solid ${C.ink}`,
    borderRadius: 22,
    boxShadow: `10px 10px 0 ${C.ink}`,
    padding: 22,
  },
  label: {
    background: C.cream,
    border: `4px solid ${C.ink}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 18,
  },
  labelTitle: {
    fontFamily: "'Space Mono', ui-monospace, monospace",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.1,
    wordBreak: "break-word",
  },
  labelArtist: {
    fontFamily: "'Space Mono', ui-monospace, monospace",
    fontSize: 13,
    marginTop: 4,
    color: "#5b4a86",
  },
  reelRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reel: { flex: "0 0 auto" },
  window: {
    flex: 1,
    height: 92,
    background: C.ink,
    borderRadius: 12,
    border: `4px solid ${C.ink}`,
    position: "relative",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  },
  tape: {
    position: "absolute",
    top: "50%", left: 0, right: 0, height: 30,
    transform: "translateY(-50%)",
    background: "linear-gradient(#6b4a2f, #3f2a18)",
  },
  eq: { display: "flex", alignItems: "flex-end", gap: 5, height: 40, zIndex: 1 },
  eqBar: { width: 7, background: C.cyan, borderRadius: 3, height: 6 },

  cassetteFoot: {
    fontFamily: "'Space Mono', ui-monospace, monospace",
    fontSize: 11,
    color: C.cream,
    textAlign: "center",
    marginTop: 16,
    letterSpacing: "0.04em",
  },

  play: {
    marginTop: 34,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 800,
    fontSize: 24,
    color: C.ink,
    background: C.softPink,
    border: `5px solid ${C.ink}`,
    borderRadius: 999,
    padding: "16px 40px",
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    boxShadow: `7px 7px 0 ${C.ink}`,
  },
  playIcon: { fontSize: 22 },
  counter: {
    fontFamily: "'Space Mono', ui-monospace, monospace",
    fontSize: 13,
    marginTop: 16,
    background: C.ink,
    color: C.sun,
    padding: "5px 12px",
    borderRadius: 999,
  },
};

// Keyframes, hover/press effects, focus rings, and reduced-motion support
const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pop  { 0% { transform: scale(0.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes bounce { 0%,100% { height: 8px; } 50% { height: 34px; } }
  @keyframes fall {
    0%   { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
    8%   { opacity: 0.9; }
    92%  { opacity: 0.9; }
    100% { transform: translate(var(--drift), 110vh) rotate(360deg); opacity: 0; }
  }

  .reel-spin { animation: spin 4s linear infinite; }
  .reel-spin-fast { animation-duration: 1.4s; }
  .label-pop { animation: pop 0.28s ease-out; }
  .eq-bar    { animation: bounce 0.7s ease-in-out infinite; }
  .rain-piece { position: absolute; top: 0; animation: fall linear infinite; }

  .play-btn { transition: transform .06s ease, box-shadow .06s ease; }
  .play-btn:hover  { transform: translate(2px, 2px); box-shadow: 5px 5px 0 ${C.ink}; }
  .play-btn:active { transform: translate(7px, 7px); box-shadow: 0 0 0 ${C.ink}; }
  .play-btn:focus-visible { outline: 4px solid ${C.cyan}; outline-offset: 4px; }

  @media (prefers-reduced-motion: reduce) {
    .reel-spin, .label-pop, .eq-bar, .rain-piece { animation: none !important; }
  }
`;
