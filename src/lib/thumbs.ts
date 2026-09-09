const PALETTES = [
  ["#1b2a44", "#0d1117", "#3b7bf0"],
  ["#1d3324", "#0d1117", "#4caf6f"],
  ["#3a1f1f", "#0d1117", "#e25b5b"],
  ["#2a2438", "#0d1117", "#8b7cf6"],
  ["#1a3030", "#0d1117", "#2bb3b3"],
  ["#33281a", "#0d1117", "#d99a2b"],
];

export function hashId(id: string) {
  return id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function muxThumbUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`;
}

export function coverUrl(id: string, title: string, playbackId?: string | null) {
  if (playbackId && !playbackId.startsWith("demo_")) {
    return muxThumbUrl(playbackId);
  }
  const pal = PALETTES[hashId(id) % PALETTES.length];
  const safe = title.replace(/[<>&"]/g, "").slice(0, 42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${pal[0]}"/>
        <stop offset="1" stop-color="${pal[1]}"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <rect x="48" y="44" width="320" height="188" rx="6" fill="${pal[2]}" opacity="0.22"/>
    <rect x="72" y="68" width="272" height="140" rx="3" fill="#000" opacity="0.35"/>
    <circle cx="520" cy="90" r="48" fill="${pal[2]}" opacity="0.18"/>
    <text x="36" y="318" fill="#f1f1f1" font-size="22" font-family="Inter,Arial,sans-serif" font-weight="600">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function fakeDurationSec(id: string) {
  const n = hashId(id);
  return 7 * 60 + (n % 38) * 60 + (n % 50);
}

export function fakeViews(id: string, real?: number) {
  if (real && real > 0) return real;
  return 180 + (hashId(id) % 8400);
}
