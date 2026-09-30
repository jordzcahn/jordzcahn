// Generates the profile README graphics as self-contained SVGs.
// Text is converted to outlines (opentype.js) so it renders the same everywhere,
// since GitHub serves repo SVGs with a CSP that blocks embedded fonts.
//   node build.mjs <outDir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, "out"));
fs.mkdirSync(out, { recursive: true });

const load = (f) => opentype.parse(fs.readFileSync(path.join(here, "fonts", f)).buffer.slice(0));
const F = {
  display: load("orbitron-900.woff"),
  title: load("orbitron-700.woff"),
  ui: load("rajdhani-700.woff"),
  uiLight: load("rajdhani-600.woff"),
  mono: load("jetbrains-mono-500.woff"),
};

const C = {
  bg0: "#070b18", bg1: "#0c1226", panel: "#0e1530", line: "#223066",
  cyan: "#3ee0ff", blue: "#58a6ff", mag: "#b86bff", orange: "#ff8a3d",
  green: "#3ddc97", gold: "#ffd166", text: "#e8eefc", muted: "#8b97b8",
};

// ---------------------------------------------------------------- text → path

function layout(font, str, size, spacing = 0) {
  const scale = size / font.unitsPerEm;
  const glyphs = [];
  let x = 0;
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    if (g.index === 0 && ch !== " ") console.warn(`missing glyph ${JSON.stringify(ch)} in ${font.names.fullName.en}`);
    glyphs.push({ g, x });
    x += g.advanceWidth * scale + spacing;
  }
  return { glyphs, width: x - spacing };
}

function textWidth(font, str, size, spacing = 0) {
  return layout(font, str, size, spacing).width;
}

// anchor: "start" | "middle" | "end"; y is the baseline.
function text(font, str, size, x, y, { anchor = "start", spacing = 0, fill = C.text, attrs = "" } = {}) {
  const { glyphs, width } = layout(font, str, size, spacing);
  const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const d = glyphs.map(({ g, x: gx }) => g.getPath(x0 + gx, y, size).toPathData(1)).join("");
  return `<path d="${d}" fill="${fill}" ${attrs}/>`;
}

// ---------------------------------------------------------------- helpers

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const svg = (w, h, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">\n${body}\n</svg>\n`;

const glow = (id, std, color) => `
  <filter id="${id}" x="-20%" y="-50%" width="140%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="b"/>
    <feFlood flood-color="${color}" flood-opacity="0.9"/>
    <feComposite in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

const scanlines = (w, h) => `
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity="0.035"/></pattern>
  </defs><rect width="${w}" height="${h}" fill="url(#scan)" pointer-events="none"/><defs>`;

// Corner brackets inside a frame.
const corners = (x, y, w, h, len, color, sw = 2) => {
  const p = [
    `M${x} ${y + len}V${y}H${x + len}`, `M${x + w - len} ${y}H${x + w}V${y + len}`,
    `M${x + w} ${y + h - len}V${y + h}H${x + w - len}`, `M${x + len} ${y + h}H${x}V${y + h - len}`,
  ];
  return `<path d="${p.join("")}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="square"/>`;
};

const panel = (w, h, r = 18) => `
  <defs>
    <linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/></linearGradient>
    <linearGradient id="pborder" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.8"/><stop offset="0.5" stop-color="${C.line}"/><stop offset="1" stop-color="${C.mag}" stop-opacity="0.8"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r}" fill="url(#pbg)" stroke="url(#pborder)" stroke-width="1.5"/>`;

const write = (name, content) => {
  fs.writeFileSync(path.join(out, name), content);
  console.log(`${name}  ${(content.length / 1024).toFixed(1)} KB`);
};

// ---------------------------------------------------------------- hero

function hero() {
  const W = 1280, H = 420, HZ = 262, VX = W / 2;
  const parts = [];

  // stars
  const stars = [];
  for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = rand() * (HZ - 20), r = rand() * 1.3 + 0.3;
    const dur = (2 + rand() * 4).toFixed(1), delay = (-rand() * 6).toFixed(1);
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" style="animation:tw ${dur}s ${delay}s infinite ease-in-out"/>`);
  }

  // perspective grid: vertical rays + horizontal lines that stream toward the camera
  const rays = [];
  for (let i = -18; i <= 18; i++) {
    const bx = VX + i * 95;
    rays.push(`<line x1="${VX}" y1="${HZ}" x2="${bx}" y2="${H}"/>`);
  }
  const N = 14, D = 38, dur = 1.6;
  const yAt = (z) => HZ + D * (N / z);
  const rows = [];
  for (let i = 1; i <= N; i++) {
    const samples = [];
    for (let s = 0; s <= 12; s++) samples.push(Math.min(yAt(N + 1 - i + 1 - s / 12), H + 40).toFixed(1));
    const vals = samples.join(";");
    rows.push(`<line x1="0" x2="${W}" y1="${samples[0]}" y2="${samples[0]}"><animate attributeName="y1" values="${vals}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="y2" values="${vals}" dur="${dur}s" repeatCount="indefinite"/></line>`);
  }

  parts.push(`<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#05061a"/><stop offset="0.55" stop-color="#140a3a"/><stop offset="${(HZ / H).toFixed(3)}" stop-color="#2a0f55"/>
    <stop offset="${(HZ / H + 0.001).toFixed(3)}" stop-color="#07051a"/><stop offset="1" stop-color="#030210"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="1" r="0.6"><stop offset="0" stop-color="${C.mag}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${C.blue}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.7"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <mask id="floorMask"><rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#fade)"/></mask>
  <linearGradient id="title" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}"/><stop offset="0.55" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.mag}"/></linearGradient>
  ${glow("tglow", 7, C.cyan)}
  ${glow("sglow", 4, C.orange)}
  <style>
    @keyframes tw{0%,100%{opacity:.15}50%{opacity:.95}}
    @keyframes blink{0%,55%{opacity:1}56%,100%{opacity:0}}
    @keyframes flick{0%,92%,100%{opacity:.55;transform:translate(0,0)}93%{opacity:.9;transform:translate(-5px,0)}95%{opacity:.2;transform:translate(4px,0)}97%{opacity:.8;transform:translate(-2px,0)}}
    @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
    .rise{animation:rise 1.1s ease-out both}
  </style>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g>${stars.join("")}</g>
<ellipse cx="${VX}" cy="${HZ}" rx="620" ry="190" fill="url(#sun)"/>
<g mask="url(#floorMask)" stroke="${C.mag}" stroke-width="1.4" opacity="0.85">${rays.join("")}</g>
<g mask="url(#floorMask)" stroke="${C.cyan}" stroke-width="1.4" opacity="0.8">${rows.join("")}</g>
<line x1="0" x2="${W}" y1="${HZ}" y2="${HZ}" stroke="${C.mag}" stroke-width="2" opacity="0.9" filter="url(#tglow)"/>`);

  // title with a glitchy magenta ghost behind it
  const title = "JORDAN CAHN";
  parts.push(`<g style="animation:flick 6s infinite">${text(F.display, title, 98, VX + 4, 172, { anchor: "middle", spacing: 6, fill: C.mag, attrs: 'opacity="0.55"' })}</g>`);
  parts.push(`<g class="rise" filter="url(#tglow)">${text(F.display, title, 98, VX, 168, { anchor: "middle", spacing: 6, fill: "url(#title)" })}</g>`);

  const sub = "GAME DEVELOPER   /   FOUNDER OF CAHN GAMES   /   SOUTH AFRICA";
  parts.push(`<g class="rise" style="animation-delay:.35s">${text(F.uiLight, sub, 24, VX, 218, { anchor: "middle", spacing: 3.5, fill: C.text, attrs: 'opacity="0.85"' })}</g>`);

  // HUD
  parts.push(corners(24, 22, W - 48, H - 44, 26, C.cyan, 2));
  parts.push(text(F.mono, "P1  JORDZ", 15, 52, 58, { fill: C.cyan, spacing: 1 }));
  const segs = [];
  for (let i = 0; i < 10; i++) segs.push(`<rect x="${52 + i * 15}" y="68" width="11" height="8" rx="1.5" fill="${i < 9 ? C.green : C.line}"${i === 8 ? ' style="animation:pulse 1.2s infinite"' : ""}/>`);
  parts.push(segs.join(""));
  parts.push(text(F.mono, "STUDIO", 13, W - 52, 52, { anchor: "end", fill: C.muted, spacing: 2 }));
  parts.push(text(F.title, "CAHN GAMES", 18, W - 52, 76, { anchor: "end", fill: C.orange, spacing: 2 }));

  parts.push(`<g style="animation:blink 1.4s steps(1) infinite" filter="url(#sglow)">${text(F.title, "PRESS START", 20, VX, 372, { anchor: "middle", spacing: 6, fill: C.orange })}</g>`);
  parts.push(`<defs>${scanlines(W, H)}</defs>`);

  write("hero.svg", svg(W, H, parts.join("\n"), "Jordan Cahn, game developer and founder of Cahn Games"));
}

// ---------------------------------------------------------------- section headers

function header(file, index, title, tag) {
  const W = 1000, H = 64;
  const tx = 92, tw = textWidth(F.title, title, 24, 3);
  const lx = tx + tw + 24, rx = W - 36 - textWidth(F.mono, tag, 13, 1) - 18;
  const body = `${panel(W, H, 14)}
<defs>
  <linearGradient id="hl" gradientUnits="userSpaceOnUse" x1="${lx}" y1="0" x2="${rx}" y2="0"><stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0.05"/></linearGradient>
  <radialGradient id="dot"><stop offset="0" stop-color="#fff"/><stop offset="0.3" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</defs>
${text(F.mono, index, 14, 26, 38, { fill: C.muted, spacing: 1 })}
<g transform="translate(66 32)"><g style="animation:spin 6s linear infinite"><rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" fill="none" stroke="${C.cyan}" stroke-width="2"/></g><circle r="2.5" fill="${C.cyan}"/></g>
${text(F.title, title, 24, tx, 41, { spacing: 3 })}
<line x1="${lx}" x2="${rx}" y1="32" y2="32" stroke="url(#hl)" stroke-width="1.5"/>
<ellipse cx="${lx}" cy="32" rx="16" ry="4" fill="url(#dot)"><animate attributeName="cx" values="${lx};${rx};${lx}" keyTimes="0;0.5;1" dur="5s" repeatCount="indefinite"/></ellipse>
${text(F.mono, tag, 13, W - 36, 37, { anchor: "end", fill: C.muted, spacing: 1 })}`;
  write(file, svg(W, H, body, title));
}

// ---------------------------------------------------------------- divider

function divider() {
  const W = 1000, H = 20;
  const body = `<defs>
  <linearGradient id="dl" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.25" stop-color="${C.cyan}"/><stop offset="0.75" stop-color="${C.mag}"/><stop offset="1" stop-color="${C.mag}" stop-opacity="0"/></linearGradient>
  <radialGradient id="dg"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="${C.cyan}" stop-opacity="0.8"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
</defs>
<line x1="0" x2="${W}" y1="10" y2="10" stroke="url(#dl)" stroke-width="1.5"/>
<rect x="${W / 2 - 6}" y="4" width="12" height="12" transform="rotate(45 ${W / 2} 10)" fill="${C.bg0}" stroke="${C.cyan}" stroke-width="1.5"/>
<ellipse cy="10" rx="40" ry="5" fill="url(#dg)"><animate attributeName="cx" values="-40;${W + 40}" dur="4s" repeatCount="indefinite"/></ellipse>`;
  write("divider.svg", svg(W, H, body, "divider"));
}

// ---------------------------------------------------------------- player card

function playerCard() {
  const W = 1000, H = 380;
  const p = [panel(W, H)];
  p.push(`<defs>
  <linearGradient id="hex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.mag}"/></linearGradient>
  <linearGradient id="shim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  ${glow("pg", 5, C.cyan)}
  <style>
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes spinr{to{transform:rotate(-360deg)}}
    @keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.6);opacity:0}}
    @keyframes sweep{from{transform:translateX(-90px)}to{transform:translateX(330px)}}
  </style>
</defs>`);

  // header strip
  p.push(`<line x1="24" x2="${W - 24}" y1="52" y2="52" stroke="${C.line}"/>`);
  p.push(text(F.mono, "PLAYER PROFILE", 13, 28, 36, { fill: C.muted, spacing: 3 }));
  p.push(`<g transform="translate(${W - 118} 31)"><circle r="5" fill="${C.green}" style="transform-box:fill-box;transform-origin:center;animation:ping 1.8s infinite"/><circle r="5" fill="${C.green}"/></g>`);
  p.push(text(F.mono, "ONLINE", 13, W - 28, 36, { anchor: "end", fill: C.green, spacing: 3 }));

  // emblem: JC in a hexagon with counter-rotating rings
  const ex = 140, ey = 190;
  const hexPts = (r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(" ");
  p.push(`<g transform="translate(${ex} ${ey})">
  <g style="animation:spin 18s linear infinite"><circle r="92" fill="none" stroke="${C.cyan}" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="4 10"/></g>
  <g style="animation:spinr 12s linear infinite"><circle r="80" fill="none" stroke="${C.mag}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="60 40 10 40"/></g>
  <polygon points="${hexPts(62)}" fill="${C.bg0}" stroke="url(#hex)" stroke-width="3" filter="url(#pg)"/>
  ${text(F.display, "JC", 46, 0, 16, { anchor: "middle", fill: "url(#hex)", spacing: 2 })}
</g>`);
  p.push(text(F.ui, "JORDAN CAHN", 22, ex, 318, { anchor: "middle", spacing: 2 }));
  p.push(text(F.mono, "aka JORDZ", 13, ex, 342, { anchor: "middle", fill: C.muted, spacing: 1 }));

  // stats
  const stats = [
    ["CLASS", "Game Developer"],
    ["GUILD", "Cahn Games  (Founder)"],
    ["BASE", "Johannesburg, South Africa"],
    ["TRAINING", "Vega School  -  Game Design & Dev"],
    ["SIDE QUEST", "Cahn Tech Solutions  -  IT Support"],
    ["MAIN", "Unity  +  C#"],
  ];
  const sx = 290;
  stats.forEach(([k, v], i) => {
    const y = 96 + i * 44;
    p.push(text(F.mono, k, 12, sx, y - 16, { fill: C.cyan, spacing: 2, attrs: 'opacity="0.85"' }));
    p.push(text(F.ui, v, 20, sx, y + 5, {}));
  });

  // quests
  const qx = 640;
  p.push(`<line x1="${qx - 30}" x2="${qx - 30}" y1="76" y2="${H - 30}" stroke="${C.line}"/>`);
  p.push(text(F.mono, "ACTIVE QUESTS", 13, qx, 86, { fill: C.muted, spacing: 3 }));
  const quests = [
    ["Launch Mothlight on iOS", "LAUNCHING", C.gold],
    ["Take RAMJAW to Steam", "IN PROGRESS", C.orange],
    ["Level up in Unreal Engine 5", "TRAINING", C.mag],
  ];
  quests.forEach(([name, status, col], i) => {
    const y = 132 + i * 72;
    p.push(`<rect x="${qx}" y="${y - 14}" width="9" height="9" transform="rotate(45 ${qx + 4.5} ${y - 9.5})" fill="${col}"/>`);
    p.push(text(F.ui, name, 19, qx + 20, y - 3, {}));
    const sw = textWidth(F.mono, status, 11, 1.5) + 16;
    p.push(`<rect x="${qx + 20}" y="${y + 8}" width="${sw.toFixed(1)}" height="20" rx="10" fill="${col}" fill-opacity="0.14" stroke="${col}" stroke-opacity="0.6"/>`);
    p.push(text(F.mono, status, 11, qx + 28, y + 22, { fill: col, spacing: 1.5 }));
    const bx = qx + 20 + sw + 10, bw = W - 40 - bx;
    p.push(`<clipPath id="qc${i}"><rect x="${bx.toFixed(1)}" y="${y + 15}" width="${bw.toFixed(1)}" height="6" rx="3"/></clipPath>`);
    p.push(`<g clip-path="url(#qc${i})"><rect x="${bx.toFixed(1)}" y="${y + 15}" width="${bw.toFixed(1)}" height="6" fill="${col}" fill-opacity="0.25"/><rect x="${bx.toFixed(1)}" y="${y + 15}" width="80" height="6" fill="url(#shim)" style="animation:sweep ${2.4 + i * 0.5}s ${i * 0.4}s linear infinite"/></g>`);
  });

  p.push(`<line x1="${qx}" x2="${W - 40}" y1="${H - 64}" y2="${H - 64}" stroke="${C.line}"/>`);
  p.push(text(F.mono, "MOTTO", 11, qx, H - 42, { fill: C.muted, spacing: 3 }));
  p.push(text(F.ui, "“In a world full of bugs, be the debug.”", 18, qx, H - 20, { fill: C.cyan }));

  write("player-card.svg", svg(W, H, p.join("\n"), "Player profile: Jordan Cahn, game developer, founder of Cahn Games"));
}

// ---------------------------------------------------------------- RAMJAW title card (no gameplay imagery)

function ramjawCard() {
  const W = 1000, H = 260;
  const p = [];
  const lines = [];
  for (let i = 0; i < 26; i++) {
    const y = 20 + rand() * (H - 40), len = 60 + rand() * 220, d = (0.6 + rand() * 1.2).toFixed(2), delay = (-rand() * 2).toFixed(2);
    lines.push(`<rect x="0" y="${y.toFixed(1)}" width="${len.toFixed(0)}" height="${(1 + rand() * 1.5).toFixed(1)}" rx="1" fill="${rand() > 0.7 ? C.orange : "#fff"}" opacity="${(0.08 + rand() * 0.2).toFixed(2)}" style="animation:zoom ${d}s ${delay}s linear infinite"/>`);
  }
  p.push(`<defs>
  <linearGradient id="rbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a0d05"/><stop offset="0.6" stop-color="#0b0706"/><stop offset="1" stop-color="#050505"/></linearGradient>
  <radialGradient id="rglow" cx="0.3" cy="0.55" r="0.6"><stop offset="0" stop-color="${C.orange}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
  <pattern id="haz" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="28" fill="#ffb020"/><rect x="14" width="14" height="28" fill="#111"/></pattern>
  <clipPath id="rclip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  ${glow("rg", 6, C.orange)}
  <style>
    @keyframes zoom{from{transform:translateX(${W + 40}px)}to{transform:translateX(-300px)}}
    @keyframes shake{0%,90%,100%{transform:translate(0,0)}92%{transform:translate(-3px,1px)}94%{transform:translate(3px,-1px)}96%{transform:translate(-2px,0)}}
    @keyframes slide{from{transform:translateX(0)}to{transform:translateX(-39.6px)}}
  </style>
</defs>
<g clip-path="url(#rclip)">
<rect width="${W}" height="${H}" fill="url(#rbg)"/>
<rect width="${W}" height="${H}" fill="url(#rglow)"/>
<g>${lines.join("")}</g>
<g style="animation:slide 1.2s linear infinite"><rect x="0" y="${H - 14}" width="${W + 60}" height="14" fill="url(#haz)"/></g>
<g style="animation:slide 1.2s linear infinite reverse"><rect x="-40" y="0" width="${W + 60}" height="10" fill="url(#haz)"/></g>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="none" stroke="${C.orange}" stroke-opacity="0.6" stroke-width="1.5"/>`);

  // logo: RAM (white) + JAW (orange), skewed for speed
  const lx = 64, ly = 146, size = 84, sp = 3;
  const ramW = textWidth(F.display, "RAM", size, sp);
  const logo = text(F.display, "RAM", size, lx, ly, { spacing: sp, fill: "#fff" }) + text(F.display, "JAW", size, lx + ramW + sp, ly, { spacing: sp, fill: C.orange });
  const logoW = textWidth(F.display, "RAMJAW", size, sp);
  p.push(`<g style="animation:shake 3.5s infinite"><g transform="translate(${lx} ${ly}) skewX(-14) translate(${-lx} ${-ly})" filter="url(#rg)">${logo}</g></g>`);
  p.push(`<rect x="${lx - 10}" y="${ly + 18}" width="${logoW + 10}" height="6" rx="3" fill="${C.orange}" transform="translate(${lx} ${ly}) skewX(-14) translate(${-lx} ${-ly})"/>`);
  p.push(text(F.ui, "ARENA  WRECKERS", 22, lx + 8, ly + 58, { spacing: 9, fill: C.text, attrs: 'opacity="0.85"' }));

  // right column
  const rx = W - 60;
  p.push(text(F.title, "DRIFT. RAM.", 22, rx, 96, { anchor: "end", spacing: 3, fill: "#fff" }));
  p.push(text(F.title, "WRECK. REPEAT.", 22, rx, 128, { anchor: "end", spacing: 3, fill: C.orange }));
  const pill = "COMING TO STEAM", pw = textWidth(F.mono, pill, 13, 2) + 28;
  p.push(`<rect x="${rx - pw}" y="160" width="${pw}" height="32" rx="16" fill="${C.orange}"/>`);
  p.push(text(F.mono, pill, 13, rx - pw / 2, 181, { anchor: "middle", spacing: 2, fill: "#140a02" }));

  write("ramjaw-card.svg", svg(W, H, p.join("\n"), "RAMJAW: Arena Wreckers. Drift, ram, wreck, repeat. Coming to Steam."));
}

// ---------------------------------------------------------------- roadmap

function roadmap() {
  const W = 1000, H = 228;
  const nodes = [
    ["DONE", "First game submitted", "to the App Store", C.green],
    ["NOW", "Mothlight launch", "RAMJAW to Steam", C.cyan],
    ["NEXT", "Grow Cahn Games", "Android + game jams", C.blue],
    ["GOAL", "Full-time", "game developer", C.mag],
    ["DREAM", "Open-world sim lead", "based in Cape Town", C.gold],
  ];
  const y = 118, x0 = 110, x1 = W - 110, step = (x1 - x0) / (nodes.length - 1);
  const p = [panel(W, H)];
  p.push(`<defs>
  ${glow("ng", 5, C.cyan)}
  <style>
    @keyframes ping{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.8);opacity:0}}
    @keyframes flow{to{stroke-dashoffset:-28}}
    @keyframes twinkle{0%,100%{opacity:.6}50%{opacity:1}}
  </style>
</defs>`);
  p.push(text(F.mono, "QUEST LOG", 13, 28, 36, { fill: C.muted, spacing: 3 }));
  p.push(`<line x1="${x0}" x2="${x0 + step}" y1="${y}" y2="${y}" stroke="${C.cyan}" stroke-width="3"/>`);
  p.push(`<line x1="${x0 + step}" x2="${x1}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width="3" stroke-dasharray="10 4" style="animation:flow 1.4s linear infinite"/>`);

  nodes.forEach(([label, a, b, col], i) => {
    const x = x0 + i * step;
    p.push(text(F.mono, label, 13, x, y - 34, { anchor: "middle", spacing: 3, fill: col }));
    if (label === "DONE") {
      p.push(`<circle cx="${x}" cy="${y}" r="15" fill="${col}"/><path d="M${x - 7} ${y}l5 5 9-10" fill="none" stroke="${C.bg0}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (label === "NOW") {
      p.push(`<g transform="translate(${x} ${y})"><circle r="12" fill="${col}" style="transform-box:fill-box;transform-origin:center;animation:ping 1.6s infinite"/><circle r="15" fill="${C.bg0}" stroke="${col}" stroke-width="3" filter="url(#ng)"/><circle r="7" fill="${col}"/></g>`);
    } else if (label === "DREAM") {
      const star = Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 7 : 17, a = -Math.PI / 2 + (k * Math.PI) / 5; return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; }).join(" ");
      p.push(`<polygon points="${star}" fill="${col}" style="animation:twinkle 2s infinite"/>`);
    } else {
      p.push(`<circle cx="${x}" cy="${y}" r="13" fill="${C.bg0}" stroke="${col}" stroke-width="3"/>`);
    }
    p.push(text(F.ui, a, 19, x, y + 52, { anchor: "middle" }));
    p.push(text(F.uiLight, b, 17, x, y + 76, { anchor: "middle", fill: C.muted }));
  });
  write("roadmap.svg", svg(W, H, p.join("\n"), "Career roadmap: done, now, next, goal, dream"));
}

hero();
divider();
playerCard();
ramjawCard();
roadmap();
header("h-about.svg", "01", "ABOUT ME", "// whoami");
header("h-building.svg", "02", "NOW BUILDING", "// in development");
header("h-stack.svg", "03", "TECH STACK", "// loadout");
header("h-roadmap.svg", "04", "ROADMAP", "// quest log");
header("h-snake.svg", "05", "CONTRIBUTIONS", "// snake.exe");
header("h-connect.svg", "06", "LET'S CONNECT", "// say hi");
