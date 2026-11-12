/**
 * Placeholder product "photos" for sample data: simple illustrations of South
 * Asian garments rendered to images. Real photographs replace these once
 * products are added through the admin portal.
 */
import sharp from "sharp";

export type GarmentKind =
  | "suit"
  | "kurta"
  | "lehenga"
  | "saree"
  | "anarkali"
  | "sherwani"
  | "dupatta"
  | "jhumka"
  | "khussa"
  | "potli";

const GOLD = "#c9a24a";
const GOLD_DARK = "#9a7628";
const HANGER = `<path d="M400 100 c-22 0 -34 -30 -10 -42 c22 -10 40 14 22 30 l-12 12 v36" fill="none" stroke="#8a6f4a" stroke-width="7" stroke-linecap="round"/>`;

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(Math.max(0, Math.min(255, out)));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Small gold motifs (buti) scattered over a garment. */
function butis(points: [number, number][], r = 7): string {
  return points
    .map(([x, y]) => `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="${GOLD}"/>`)
    .join("");
}

/** Each garment is drawn in an 800x1000 box. "id" keeps gradient names unique when several share one image. */
function garment(kind: GarmentKind, fill: string, id = "g"): string {
  const d = shade(fill, -0.3);
  const hi = shade(fill, 0.16);
  const pale = shade(fill, 0.55);
  const line = `fill="none" stroke="${d}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  const body = `fill="url(#${id})" stroke="${d}" stroke-width="5" stroke-linejoin="round"`;
  const under = `fill="${pale}" stroke="${shade(pale, -0.25)}" stroke-width="5" stroke-linejoin="round"`;
  const zari = (w: number) => `fill="none" stroke="${GOLD}" stroke-width="${w}" stroke-linecap="round"`;
  const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${fill}"/></linearGradient></defs>`;

  switch (kind) {
    case "suit":
      return `${defs}${HANGER}
<path ${under} d="M296 700 L396 700 L384 900 C362 912 322 912 300 900 Z"/><path ${under} d="M404 700 L504 700 L500 900 C478 912 438 912 416 900 Z"/>
<path ${zari(10)} d="M302 886 L384 886 M418 886 L498 886"/>
<path ${body} d="M316 150 C340 208 460 208 484 150 L600 200 L668 560 L600 578 L548 380 L572 770 C460 790 340 790 228 770 L252 380 L200 578 L132 560 L200 200 Z"/>
<path ${zari(12)} d="M318 156 C342 212 458 212 482 156"/><path ${zari(8)} d="M400 200 L400 330"/>
<path ${zari(18)} d="M234 750 C340 770 460 770 566 750"/><path ${zari(5)} d="M236 724 C340 744 460 744 564 724"/>
<path ${zari(12)} d="M140 548 L204 566 M660 548 L596 566"/>
<path ${line} d="M248 600 L236 762 M552 600 L564 762" opacity=".5"/>
${butis([[330, 440], [400, 480], [470, 440], [330, 560], [400, 600], [470, 560], [365, 660], [435, 660]])}`;
    case "kurta":
      return `${defs}${HANGER}
<path ${body} d="M320 150 C342 202 458 202 480 150 L590 196 L650 520 L584 536 L540 370 L552 850 C450 866 350 866 248 850 L260 370 L216 536 L150 520 L210 196 Z"/>
<path ${zari(9)} d="M322 156 C344 206 456 206 478 156"/>
<path ${line} d="M384 196 L384 420 L416 420 L416 196"/>
<circle cx="400" cy="250" r="6" fill="${GOLD}"/><circle cx="400" cy="310" r="6" fill="${GOLD}"/><circle cx="400" cy="370" r="6" fill="${GOLD}"/>
<path ${zari(8)} d="M158 510 L220 526 M642 510 L580 526"/>
<path ${line} d="M256 680 L250 846 M544 680 L550 846" opacity=".55"/>
<path ${zari(7)} d="M252 830 C350 846 450 846 548 830"/>`;
    case "lehenga":
      return `${defs}
<path ${body} d="M330 130 C350 182 450 182 470 130 L540 160 L586 284 L536 302 L520 262 L514 340 C440 352 360 352 286 340 L280 262 L264 302 L214 284 L260 160 Z"/>
<path ${zari(10)} d="M332 136 C352 186 448 186 468 136"/><path ${zari(12)} d="M288 326 C360 338 440 338 512 326"/><path ${zari(9)} d="M220 276 L266 292 M580 276 L534 292"/>
<path ${body} d="M300 392 C360 404 440 404 500 392 C584 560 672 760 704 880 C500 922 300 922 96 880 C128 760 216 560 300 392 Z"/>
<path ${zari(14)} d="M302 396 C360 408 440 408 498 396"/>
<path ${line} d="M340 410 L250 890 M400 412 L400 900 M460 410 L550 890 M318 404 L160 876 M482 404 L640 876" opacity=".35"/>
<path ${zari(30)} d="M106 862 C300 902 500 902 694 862"/><path ${zari(6)} d="M118 822 C300 860 500 860 682 822"/>
<path fill="none" stroke="${GOLD_DARK}" stroke-width="3" stroke-dasharray="4 14" d="M106 862 C300 902 500 902 694 862"/>
${butis([[330, 520], [400, 500], [470, 520], [290, 640], [360, 620], [440, 620], [510, 640], [250, 750], [330, 740], [400, 730], [470, 740], [550, 750]], 8)}`;
    case "anarkali":
      return `${defs}${HANGER}
<path ${body} d="M320 150 C342 200 458 200 480 150 L580 188 L640 520 L580 536 L530 356 L520 404 C600 584 662 764 682 892 C500 926 300 926 118 892 C138 764 200 584 280 404 L270 356 L220 536 L160 520 L220 188 Z"/>
<path ${zari(10)} d="M322 156 C344 206 456 206 478 156"/>
<path ${zari(14)} d="M280 404 C350 420 450 420 520 404"/>
<path ${zari(9)} d="M168 510 L226 526 M632 510 L574 526"/>
<path ${line} d="M330 424 L230 900 M400 426 L400 910 M470 424 L570 900" opacity=".35"/>
<path ${zari(26)} d="M128 876 C300 908 500 908 672 876"/><path ${zari(5)} d="M138 840 C300 872 500 872 662 840"/>
${butis([[360, 260], [440, 260], [400, 320], [320, 560], [400, 540], [480, 560], [280, 700], [360, 690], [440, 690], [520, 700]])}`;
    case "saree":
      return `${defs}
<path ${under} d="M330 150 C350 196 450 196 470 150 L532 182 L562 286 L516 298 L506 330 C440 342 360 342 294 330 L284 298 L238 286 L268 182 Z"/>
<path ${body} d="M298 334 C360 346 440 346 502 334 L544 890 C450 912 350 912 256 890 Z"/>
<path ${line} d="M400 350 L372 896 M400 350 L400 900 M400 350 L428 896 M400 350 L456 892 M400 350 L344 892" opacity=".4"/>
<path ${zari(26)} d="M260 874 C350 896 450 896 540 874"/>
<path ${body} d="M512 340 L528 446 L300 240 L320 160 Z"/>
<path ${zari(12)} d="M512 340 L320 160"/>
<path ${body} d="M320 160 L246 178 L186 650 L266 664 L300 240 Z"/>
<path ${zari(22)} d="M192 632 L262 644"/><path ${zari(8)} d="M250 186 L194 610"/>
<path fill="none" stroke="${GOLD_DARK}" stroke-width="4" stroke-linecap="round" d="M196 664 v26 M212 667 v26 M228 670 v26 M244 673 v26 M260 676 v26"/>
${butis([[340, 480], [440, 470], [300, 620], [400, 600], [490, 620], [320, 760], [420, 750], [500, 770]])}`;
    case "sherwani":
      return `${defs}${HANGER}
<path ${under} d="M300 800 L392 804 L378 902 L326 902 Z"/><path ${under} d="M408 804 L500 800 L474 902 L422 902 Z"/>
<path ${body} d="M322 150 L400 160 L478 150 L600 196 L660 600 L590 616 L545 384 L560 810 C450 824 350 824 240 810 L255 384 L210 616 L140 600 L200 196 Z"/>
<path fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="4" stroke-linejoin="round" d="M348 126 L452 126 L466 160 L400 172 L334 160 Z"/>
<path ${line} d="M400 172 L400 816"/>
${[230, 310, 390, 470, 550].map((y) => `<circle cx="400" cy="${y}" r="9" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="2"/>`).join("")}
<path ${zari(12)} d="M148 590 L212 606 M652 590 L588 606"/>
<path ${zari(6)} d="M244 794 C350 808 450 808 556 794"/>
`;
    case "dupatta":
      return `${defs}${HANGER}
<path ${body} d="M250 178 C300 152 360 142 412 146 L402 852 L232 832 Z"/>
<path ${zari(20)} d="M238 812 L400 830"/><path ${zari(6)} d="M242 778 L400 796"/><path ${zari(7)} d="M258 192 L240 800"/>
<path fill="none" stroke="${GOLD_DARK}" stroke-width="4" stroke-linecap="round" d="M244 846 v30 M270 849 v30 M296 852 v30 M322 855 v30 M348 858 v30 M374 861 v30 M398 864 v30"/>
<path ${body} d="M388 146 C450 140 510 152 550 178 L584 640 L420 662 Z"/>
<path ${zari(20)} d="M426 642 L580 622"/><path ${zari(6)} d="M424 608 L576 588"/><path ${zari(7)} d="M542 192 L574 612"/>
<path fill="none" stroke="${GOLD_DARK}" stroke-width="4" stroke-linecap="round" d="M432 674 v28 M458 671 v28 M484 668 v28 M510 664 v28 M536 661 v28 M562 657 v28"/>
${butis([[310, 300], [330, 420], [300, 540], [320, 660], [470, 280], [490, 390], [480, 500]])}`;
    case "jhumka": {
      const one = (x: number) => `
<circle cx="${x}" cy="300" r="40" fill="url(#${id})" stroke="${d}" stroke-width="5"/><circle cx="${x}" cy="300" r="14" fill="#8c1c2c"/>
<path ${line} d="M${x} 340 L${x} 400"/>
<path ${body} d="M${x - 100} 540 C${x - 100} 390 ${x + 100} 390 ${x + 100} 540 Z"/>
<path ${line} d="M${x - 70} 470 C${x - 30} 440 ${x + 30} 440 ${x + 70} 470 M${x - 92} 510 C${x - 40} 480 ${x + 40} 480 ${x + 92} 510" opacity=".6"/>
<rect x="${x - 108}" y="536" width="216" height="22" rx="8" fill="url(#${id})" stroke="${d}" stroke-width="5"/>
${[-84, -42, 0, 42, 84].map((o) => `<path ${line} d="M${x + o} 560 v24"/><circle cx="${x + o}" cy="600" r="15" fill="${o % 84 === 0 ? "#8c1c2c" : "#f5efe2"}" stroke="${d}" stroke-width="4"/>`).join("")}`;
      return `${defs}${one(260)}${one(540)}`;
    }
    case "khussa":
      return `${defs}
<path ${body} d="M110 640 C110 588 190 566 264 588 C356 616 430 556 504 556 C584 556 640 606 700 598 C732 592 742 558 722 540 C766 556 776 640 724 682 C694 706 644 716 604 716 L150 716 C120 716 110 680 110 640 Z"/>
<path fill="${shade(fill, -0.45)}" d="M112 712 h560 c30 0 50 -6 62 -18 c-6 30 -30 44 -70 44 h-528 c-18 0 -26 -10 -24 -26 z"/>
<path ${zari(9)} d="M264 590 C340 640 470 640 560 590"/><path ${zari(5)} d="M150 640 C300 690 560 690 700 630"/>
${butis([[340, 640], [420, 648], [500, 636], [600, 630]], 9)}
<circle cx="716" cy="556" r="14" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="3"/>`;
    case "potli":
      return `${defs}
<path fill="none" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" d="M330 340 C250 120 550 120 470 340"/>
<path ${body} d="M270 470 C304 404 334 384 300 330 L500 330 C466 384 496 404 530 470 C460 494 340 494 270 470 Z"/>
<path ${body} d="M250 482 C198 564 178 764 258 842 C340 892 460 892 542 842 C622 764 602 564 550 482 C480 506 320 506 250 482 Z"/>
<path ${zari(16)} d="M262 478 C340 502 460 502 538 478"/>
<path ${line} d="M330 340 L320 462 M400 334 L400 480 M470 340 L480 462" opacity=".45"/>
${butis([[320, 600], [400, 580], [480, 600], [290, 700], [360, 690], [440, 690], [510, 700], [340, 790], [460, 790]], 9)}
<circle cx="400" cy="690" r="5" fill="${GOLD}"/>`;
  }
}

const BACKDROPS = [
  ["#f4eadb", "#e8d9c3", "#fbf5ea"],
  ["#eaeee6", "#d9e0d2", "#f6f8f1"],
  ["#f3e4e0", "#e6cfc9", "#fbf1ee"],
] as const;

function productSvg(kind: GarmentKind, color: string, variant: number): string {
  const [a, b, niche] = BACKDROPS[variant % BACKDROPS.length];
  // Variant 0 is the full view in an arched niche; later variants are closer crops, like detail shots.
  const transform =
    variant === 0
      ? "translate(132 190) scale(.92)"
      : variant === 1
        ? "translate(-140 -60) scale(1.6)"
        : "translate(-420 -900) scale(2.3)";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b1d10" stop-opacity=".2"/><stop offset="1" stop-color="#3b1d10" stop-opacity="0"/></radialGradient></defs>
<rect width="1000" height="1250" fill="url(#bg)"/>
${
  variant === 0
    ? `<path d="M120 1250 V560 C120 380 250 330 360 240 C420 190 470 150 500 90 C530 150 580 190 640 240 C750 330 880 380 880 560 V1250 Z" fill="${niche}" stroke="${GOLD}" stroke-opacity=".55" stroke-width="4"/>
<ellipse cx="500" cy="1130" rx="290" ry="30" fill="url(#sh)"/>`
    : ""
}
<g transform="${transform}">${garment(kind, color)}</g>
</svg>`;
}

export async function renderProductImage(kind: GarmentKind, color: string, variant: number) {
  const data = await sharp(Buffer.from(productSvg(kind, color, variant))).webp({ quality: 82 }).toBuffer();
  return { data, width: 1000, height: 1250 };
}

/** Homepage hero: three outfits against a deep maroon wall with a gold lattice. The page crops it into an arch. */
export async function renderHeroImage() {
  const place = (kind: GarmentKind, color: string, id: string, x: number, y: number, scale: number) =>
    `<ellipse cx="${x + 400 * scale}" cy="${y + 960 * scale}" rx="${260 * scale}" ry="${26 * scale}" fill="#000" opacity=".25"/>
<g transform="translate(${x} ${y}) scale(${scale})">${garment(kind, color, id)}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
<defs><pattern id="jali" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M36 4 L68 36 L36 68 L4 36 Z M36 24 L48 36 L36 48 L24 36 Z" fill="none" stroke="${GOLD}" stroke-width="2" opacity=".4"/></pattern>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a2233"/><stop offset="1" stop-color="#5a121d"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#f4d9a0" stop-opacity=".32"/><stop offset="1" stop-color="#f4d9a0" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="1500" fill="url(#wall)"/><rect width="1200" height="1500" fill="url(#jali)"/><rect width="1200" height="1500" fill="url(#glow)"/>
<rect y="1370" width="1200" height="130" fill="#47101a"/><rect y="1366" width="1200" height="6" fill="${GOLD}"/>
${place("anarkali", "#0f5a45", "h0", 20, 640, 0.66)}
${place("sherwani", "#efe4cc", "h1", 650, 640, 0.66)}
${place("lehenga", "#c9a24a", "h2", 240, 520, 0.9)}
</svg>`;
  const data = await sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer();
  return { data, width: 1200, height: 1500 };
}
