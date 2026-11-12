/**
 * Placeholder product "photos" for sample data: simple garment illustrations
 * rendered to images. Real photographs replace these once products are added
 * through the admin portal.
 */
import sharp from "sharp";

export type GarmentKind = "dress" | "shirt" | "top" | "pants" | "jeans" | "jacket" | "shoes" | "bag";

const HANGER = `<path d="M400 96 c-22 0 -34 -30 -10 -42 c22 -10 40 14 22 30 l-12 12 v40" fill="none" stroke="#8a7f72" stroke-width="7" stroke-linecap="round"/>`;

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(Math.max(0, Math.min(255, out)));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Each garment is drawn in an 800x1000 box. "d" is the line colour for seams and details. */
function garment(kind: GarmentKind, fill: string): string {
  const d = shade(fill, -0.28);
  const hi = shade(fill, 0.18);
  const line = `fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  const body = `fill="url(#g)" stroke="${d}" stroke-width="5" stroke-linejoin="round"`;
  const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${fill}"/></linearGradient></defs>`;

  switch (kind) {
    case "dress":
      return `${defs}${HANGER}<path ${body} d="M318 150 C330 215 470 215 482 150 L528 172 L506 420 C566 590 612 750 634 880 C480 912 320 912 166 880 C188 750 234 590 294 420 L272 172 Z"/><path ${line} d="M296 420 C360 440 440 440 504 420"/><path ${line} d="M400 440 L400 890" opacity=".35"/><path ${line} d="M330 460 L250 884 M470 460 L550 884" opacity=".25"/>`;
    case "top":
      return `${defs}${HANGER}<path ${body} d="M302 160 C340 222 460 222 498 160 L660 240 L612 400 L536 366 L546 800 C450 818 350 818 254 800 L264 366 L188 400 L140 240 Z"/><path ${line} d="M302 160 C340 250 460 250 498 160" opacity=".5"/><path ${line} d="M264 366 L270 300 M536 366 L530 300" opacity=".4"/>`;
    case "shirt":
      return `${defs}${HANGER}<path ${body} d="M316 150 L400 200 L484 150 L640 222 L704 640 L622 658 L562 410 L566 850 C456 866 344 866 234 850 L238 410 L178 658 L96 640 L160 222 Z"/><path ${line} d="M316 150 L360 250 L400 200 L440 250 L484 150"/><path ${line} d="M400 200 L400 856" opacity=".55"/><circle cx="400" cy="320" r="6" fill="${d}"/><circle cx="400" cy="440" r="6" fill="${d}"/><circle cx="400" cy="560" r="6" fill="${d}"/><circle cx="400" cy="680" r="6" fill="${d}"/><path ${line} d="M460 330 h62 v64 h-62 z" opacity=".5"/>`;
    case "jacket":
      return `${defs}${HANGER}<path ${body} d="M306 146 L400 190 L494 146 L662 226 L726 690 L632 708 L578 430 L584 870 C460 884 340 884 216 870 L222 430 L168 708 L74 690 L138 226 Z"/><path ${line} d="M306 146 L344 330 L400 420 L456 330 L494 146"/><path ${line} d="M400 420 L400 876"/><path ${line} d="M260 620 h90 M450 620 h90" /><path ${line} d="M632 650 L724 634 M168 650 L76 634" opacity=".5"/><circle cx="424" cy="500" r="8" fill="${d}"/><circle cx="424" cy="600" r="8" fill="${d}"/>`;
    case "pants":
      return `${defs}<path ${body} d="M262 130 L538 130 L582 890 L436 896 L400 400 L364 896 L218 890 Z"/><path ${line} d="M262 176 L538 176"/><path ${line} d="M400 176 L400 400" opacity=".6"/><path ${line} d="M300 180 L330 880 M500 180 L470 880" opacity=".25"/>`;
    case "jeans":
      return `${defs}<path ${body} d="M256 130 L544 130 L570 890 L440 896 L400 420 L360 896 L230 890 Z"/><path ${line} d="M256 178 L544 178"/><path ${line} d="M400 178 L400 420" opacity=".6"/><path ${line} d="M270 190 C290 250 340 262 360 190 M530 190 C510 250 460 262 440 190" stroke-dasharray="10 9"/><path ${line} d="M236 850 h124 M440 850 h124" stroke-dasharray="10 9" opacity=".7"/><circle cx="400" cy="154" r="8" fill="${shade(fill, 0.5)}"/>`;
    case "shoes":
      return `${defs}<path ${body} d="M120 600 C116 520 190 480 250 520 C320 566 380 470 450 440 C500 420 520 520 600 560 C690 590 720 610 716 680 L712 720 L124 720 Z"/><path fill="${shade(fill, 0.75)}" stroke="${d}" stroke-width="5" d="M118 716 h600 v34 c0 14 -10 22 -24 22 h-552 c-14 0 -24 -8 -24 -22 z"/><path ${line} d="M392 484 L452 560 M430 458 L490 536 M462 440 L522 520" /><path ${line} d="M250 520 C300 600 420 640 600 640" opacity=".45"/>`;
    case "bag":
      return `${defs}<path fill="none" stroke="${d}" stroke-width="16" stroke-linecap="round" d="M292 440 C292 220 508 220 508 440"/><path ${body} d="M196 430 H604 L648 850 C500 880 300 880 152 850 Z"/><path ${line} d="M196 500 H604" opacity=".5"/><rect x="368" y="476" width="64" height="48" rx="8" fill="${shade(fill, 0.6)}" stroke="${d}" stroke-width="5"/>`;
  }
}

const BACKDROPS = [
  ["#f3ece2", "#e6dccd"],
  ["#eef0ea", "#dfe3d8"],
  ["#f2e9e4", "#e7d8d0"],
  ["#eceae6", "#dcd8d0"],
] as const;

function productSvg(kind: GarmentKind, color: string, variant: number): string {
  const [a, b] = BACKDROPS[variant % BACKDROPS.length];
  // Variant 0 is the full view; later variants are closer crops, like detail shots.
  const transform =
    variant === 0
      ? "translate(100 150) scale(1)"
      : variant === 1
        ? "translate(-140 -40) scale(1.6)"
        : "translate(-500 -420) scale(2.3)";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="1000" height="1250" fill="url(#bg)"/>
${variant === 0 ? `<ellipse cx="500" cy="1090" rx="300" ry="34" fill="url(#sh)"/>` : ""}
<g transform="${transform}">${garment(kind, color)}</g>
</svg>`;
}

export async function renderProductImage(kind: GarmentKind, color: string, variant: number) {
  const data = await sharp(Buffer.from(productSvg(kind, color, variant))).webp({ quality: 82 }).toBuffer();
  return { data, width: 1000, height: 1250 };
}

/** A wide composition for the homepage hero: a rail of garments under an arch. */
export async function renderHeroImage() {
  const items: [GarmentKind, string][] = [
    ["dress", "#b5654a"],
    ["shirt", "#f1ece3"],
    ["jacket", "#5d6b57"],
    ["top", "#d9b8a0"],
    ["dress", "#2f3437"],
  ];
  // Each garment has its own gradient id so colours do not clash inside one SVG.
  const hung = items
    .map(([kind, color], i) => {
      const svg = garment(kind, color).replaceAll('id="g"', `id="g${i}"`).replaceAll("url(#g)", `url(#g${i})`);
      return `<g transform="translate(${180 + i * 250} 300) scale(.62)">${svg}</g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
<defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe6da"/><stop offset="1" stop-color="#e2d5c5"/></linearGradient></defs>
<rect width="1600" height="1200" fill="url(#wall)"/>
<path d="M260 1200 V560 C260 180 1340 180 1340 560 V1200 Z" fill="#f7f1e8"/>
<rect y="1020" width="1600" height="180" fill="#d8c8b4"/>
<rect x="150" y="318" width="1300" height="12" rx="6" fill="#8a7f72"/>
<rect x="196" y="330" width="12" height="700" fill="#8a7f72"/><rect x="1392" y="330" width="12" height="700" fill="#8a7f72"/>
${hung}
</svg>`;
  const data = await sharp(Buffer.from(svg)).webp({ quality: 84 }).toBuffer();
  return { data, width: 1600, height: 1200 };
}
