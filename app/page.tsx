"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// A song we've fetched from the iTunes Search API, trimmed down to just
// what the cassette UI needs.
type Song = {
  title: string;
  artist: string;
  artwork: string;
  previewUrl: string;
  genre?: string;
};

// Fixed burst positions for the related-track tiles, offset in % relative
// to the cassette so they "spill out" to either side regardless of screen
// size. --rot is read by the tileIn keyframe below.
const RELATED_LAYOUT: Array<{ top: string; left?: string; right?: string; rotate: number }> = [
  { top: "-8%",  left: "-12%",  rotate: -12 },
  { top: "30%",  left: "-18%",  rotate: 9 },
  { top: "68%",  left: "-10%",  rotate: -7 },
  { top: "-8%",  right: "-12%", rotate: 12 },
  { top: "30%",  right: "-18%", rotate: -9 },
  { top: "68%",  right: "-10%", rotate: 7 },
];

// Everyday words we feed into the iTunes search so every "Play" press
// turns up something different — a cheap way to fake "shuffle the crate".
const SEARCH_TERMS = [
  "love", "night", "dream", "summer", "heart", "sunshine", "rain",
  "dance", "blue", "gold", "wonder", "home", "wild", "sweet", "electric",
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

type RainPiece = {
  id: number;
  isFlower: boolean;
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  color: string;
};

// Build the falling confetti + flower "rain" pieces (random positions/speeds).
// Called only on the client, after mount, so the server-rendered HTML never
// contains these random values (see the useEffect below for why).
function generateRain(): RainPiece[] {
  return Array.from({ length: 42 }).map((_, i) => {
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
}

export default function BugsAndBrews() {
  // The song currently loaded on the "tape" (null = nothing played yet)
  const [song, setSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks from the same artist/genre, radiating around the cassette.
  // Starts empty on both server and client, so it never causes a hydration
  // mismatch — it only ever fills in from client-side fetches after mount.
  const [related, setRelated] = useState<Song[]>([]);

  // Start with no rain pieces (matches the server-rendered HTML exactly),
  // then fill them in with random values once we're safely on the client.
  const [rain, setRain] = useState<RainPiece[]>([]);
  useEffect(() => {
    setRain(generateRain());
  }, []);

  // The actual audio playback happens through this hidden <audio> element —
  // we just point its `src` at the preview clip and call play()/pause().
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Ask the iTunes Search API for a batch of songs matching a random word,
  // then keep only the ones that actually have a 30-second preview clip.
  async function fetchRandomSong(): Promise<Song> {
    const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const url = `https://itunes.apple.com/search?media=music&limit=50&term=${encodeURIComponent(term)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("iTunes search request failed");

    const data = await res.json();
    const candidates = (data.results ?? []).filter(
      (r: { previewUrl?: string; trackName?: string; artistName?: string }) =>
        r.previewUrl && r.trackName && r.artistName
    );
    if (candidates.length === 0) throw new Error("No previewable tracks found");

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      title: pick.trackName,
      artist: pick.artistName,
      // iTunes gives us a tiny 100x100 thumbnail by default — swap it for
      // the larger 300x300 version so the artwork isn't blurry.
      artwork: (pick.artworkUrl100 ?? "").replace("100x100", "300x300"),
      previewUrl: pick.previewUrl,
      genre: pick.primaryGenreName,
    };
  }

  // Ask iTunes for a handful of tracks from the same artist, topping up
  // with same-genre tracks if the artist alone doesn't have enough previews.
  // Best-effort: any network hiccup just means no tiles show up.
  async function fetchRelatedSongs(current: Song): Promise<Song[]> {
    const seen = new Set<string>([current.previewUrl]);
    const pool: Song[] = [];

    const search = async (term: string) => {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(term)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const results = (data.results ?? []) as Array<{
          previewUrl?: string;
          trackName?: string;
          artistName?: string;
          artworkUrl100?: string;
          primaryGenreName?: string;
        }>;
        for (const r of results) {
          if (pool.length >= 6) return;
          if (!r.previewUrl || !r.trackName || !r.artistName || seen.has(r.previewUrl)) continue;
          seen.add(r.previewUrl);
          pool.push({
            title: r.trackName,
            artist: r.artistName,
            artwork: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
            previewUrl: r.previewUrl,
            genre: r.primaryGenreName,
          });
        }
      } catch {
        // network hiccup — related tiles just won't show up this time
      }
    };

    await search(current.artist);
    if (pool.length < 6 && current.genre) await search(current.genre);

    return pool.sort(() => Math.random() - 0.5).slice(0, 6);
  }

  // Fetch a brand new random song and start playing it.
  async function discover() {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchRandomSong();
      setSong(next);
      setPlaying(true);
    } catch {
      setError("Couldn't reach the mixtape shelf — check your connection and try again.");
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  // The big button: first press fetches+plays a song, later presses just
  // toggle play/pause on the track that's already loaded.
  function togglePlay() {
    if (!song) {
      discover();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => setError("Tap play again to start the preview."));
      setPlaying(true);
    }
  }

  // Whenever we load a new song, point the <audio> element at its preview
  // clip and start playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !song) return;
    audio.src = song.previewUrl;
    audio.play().catch(() => {
      setError("Tap play again to start the preview.");
      setPlaying(false);
    });
  }, [song]);

  // Whenever the loaded song changes, go find some neighbors for it. Only
  // fires when `song` itself changes (a new track), not on play/pause toggles.
  useEffect(() => {
    if (!song) return;
    let cancelled = false;
    fetchRelatedSongs(song).then((list) => {
      if (!cancelled) setRelated(list);
    });
    return () => {
      cancelled = true;
    };
  }, [song]);

  // Clicking a related tile swaps it in as the now-playing track.
  function playRelated(picked: Song) {
    setError(null);
    setSong(picked);
    setPlaying(true);
  }

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* Falling confetti + flowers drifting down the background */}
      <div style={styles.rainLayer} aria-hidden="true">
        {rain.map((p) =>
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

        {/* ── THE CASSETTE (the centerpiece), with related tracks spilling
             out around it once a song is playing ── */}
        <div style={styles.cassetteWrap}>
          {(song ? related : []).map((r, i) => {
            const pos = RELATED_LAYOUT[i % RELATED_LAYOUT.length];
            return (
              <button
                key={r.previewUrl}
                type="button"
                className="related-tile"
                onClick={() => playRelated(r)}
                title={`${r.title} — ${r.artist}`}
                aria-label={`Play ${r.title} by ${r.artist}`}
                style={{
                  ...styles.relatedTile,
                  top: pos.top,
                  left: pos.left,
                  right: pos.right,
                  ["--rot"]: `${pos.rotate}deg`,
                } as CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.artwork} alt="" style={styles.relatedArt} />
              </button>
            );
          })}

          <div className="cassette" style={styles.cassette}>
            {/* Label strip — re-keyed so it pops each time the song changes */}
            <div key={song?.previewUrl ?? "idle"} className="label-pop" style={styles.label}>
              {song ? (
                <div style={styles.labelRow}>
                  {song.artwork && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={song.artwork} alt="" style={styles.artwork} />
                  )}
                  <div style={styles.labelText}>
                    <div style={styles.labelTitle}>{song.title}</div>
                    <div style={styles.labelArtist}>by {song.artist}</div>
                  </div>
                </div>
              ) : error ? (
                <>
                  <div style={styles.labelTitle}>⚠ {error}</div>
                  <div style={styles.labelArtist}>tap play to try again</div>
                </>
              ) : (
                <>
                  <div style={styles.labelTitle}>{loading ? "▷ FINDING A TRACK…" : "▷ PRESS PLAY"}</div>
                  <div style={styles.labelArtist}>{loading ? "hang tight" : "your mixtape awaits"}</div>
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
        </div>

        {/* ── THE BIG PLAY BUTTON ── */}
        <button
          className="play-btn"
          style={{ ...styles.play, opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}
          onClick={togglePlay}
          disabled={loading}
        >
          <span style={styles.playIcon}>
            {loading ? "⋯" : song ? (playing ? "❚❚" : "▶") : "▶"}
          </span>
          {loading ? "Loading" : song ? (playing ? "Pause" : "Resume") : "Play"}
        </button>

        {/* Grab a different random song without leaving the current one paused forever */}
        {song && (
          <button
            className="shuffle-btn"
            style={{ ...styles.shuffle, opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}
            onClick={discover}
            disabled={loading}
          >
            🔀 Next track
          </button>
        )}

        <p style={styles.counter}>
          {loading ? "shuffling the iTunes crate…" : song ? "fresh from the iTunes catalog" : "tap play for a surprise pick"}
        </p>

        {/* Hidden audio element — this is what actually plays the 30s preview */}
        <audio ref={audioRef} onEnded={() => setPlaying(false)} />
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

  cassetteWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 460,
  },
  cassette: {
    width: "100%",
    background: C.grape,
    border: `5px solid ${C.ink}`,
    borderRadius: 22,
    boxShadow: `10px 10px 0 ${C.ink}`,
    padding: 22,
  },
  relatedTile: {
    position: "absolute",
    width: 62,
    height: 62,
    padding: 0,
    border: `3px solid ${C.ink}`,
    borderRadius: 10,
    background: C.cream,
    boxShadow: `4px 4px 0 ${C.ink}`,
    overflow: "hidden",
    cursor: "pointer",
    zIndex: 3,
  },
  relatedArt: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  label: {
    background: C.cream,
    border: `4px solid ${C.ink}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 18,
  },
  labelRow: { display: "flex", alignItems: "center", gap: 12, textAlign: "left" },
  labelText: { minWidth: 0 },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: 8,
    border: `3px solid ${C.ink}`,
    objectFit: "cover",
    flexShrink: 0,
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
  shuffle: {
    marginTop: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: 15,
    color: C.ink,
    background: C.cyan,
    border: `4px solid ${C.ink}`,
    borderRadius: 999,
    padding: "8px 20px",
    boxShadow: `4px 4px 0 ${C.ink}`,
  },
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

  .shuffle-btn { transition: transform .06s ease, box-shadow .06s ease; }
  .shuffle-btn:hover  { transform: translate(2px, 2px); box-shadow: 2px 2px 0 ${C.ink}; }
  .shuffle-btn:active { transform: translate(4px, 4px); box-shadow: 0 0 0 ${C.ink}; }
  .shuffle-btn:focus-visible { outline: 4px solid ${C.pink}; outline-offset: 4px; }

  @keyframes tileIn {
    from { opacity: 0; transform: rotate(var(--rot, 0deg)) scale(0.8); }
    to   { opacity: 1; transform: rotate(var(--rot, 0deg)) scale(1); }
  }
  .related-tile {
    transform: rotate(var(--rot, 0deg));
    animation: tileIn 0.3s ease-out backwards;
    transition: box-shadow .12s ease, filter .12s ease;
  }
  .related-tile:hover  { box-shadow: 6px 6px 0 ${C.ink}; filter: brightness(1.08); }
  .related-tile:active { box-shadow: 1px 1px 0 ${C.ink}; }
  .related-tile:focus-visible { outline: 3px solid ${C.cyan}; outline-offset: 3px; }

  @media (prefers-reduced-motion: reduce) {
    .reel-spin, .label-pop, .eq-bar, .rain-piece, .related-tile { animation: none !important; }
  }
`;
