import type { Condition } from "@/lib/conditions";
import type { GarmentKind } from "./artwork";

/** Groups and the categories inside them, in display order. */
export const seedCategoryGroups: { name: string; children: string[] }[] = [
  { name: "Women", children: ["Shalwar Kameez", "Kurtis", "Lehengas", "Sarees", "Anarkalis", "Dupattas"] },
  { name: "Men", children: ["Kurtas", "Sherwanis"] },
  { name: "Kids", children: ["Girls", "Boys"] },
  { name: "Accessories", children: ["Jewellery", "Bags & Shoes"] },
];

export type SeedProduct = {
  name: string;
  description: string;
  category: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  fabric?: string;
  pieces?: number;
  stitching?: "stitched" | "unstitched";
  occasion?: "casual" | "formal" | "party" | "festive" | "wedding" | "bridal";
  imperfections?: string;
  /** Colour used to draw the placeholder picture. */
  hex: string;
  art: GarmentKind;
  condition: Condition;
  price: number;
  status: "draft" | "available" | "sold" | "archived";
  featured?: boolean;
  images?: number;
};

/** Sample inventory. Listed oldest first; the last entries are the "newest arrivals". */
export const seedProducts: SeedProduct[] = [
  { name: "Teal Embroidered Lawn Suit", description: "Three-piece lawn suit with thread embroidery on the neckline, matching trousers and a chiffon dupatta. Worn twice.", category: "Shalwar Kameez", brand: "Khaadi", size: "M", color: "Teal", fabric: "Lawn", pieces: 3, stitching: "stitched", occasion: "casual", imperfections: "None noticed.", hex: "#1f6f6a", art: "suit", condition: "like_new", price: 45, status: "available", featured: true, images: 3 },
  { name: "Blush Pink Chikankari Suit", description: "Hand-embroidered chikankari kameez in soft cotton with a plain shalwar. Light and breathable.", category: "Shalwar Kameez", brand: "Sapphire", size: "S", color: "Pink", fabric: "Cotton", pieces: 2, stitching: "stitched", occasion: "casual", imperfections: "Faint mark inside the left cuff, not visible when worn.", hex: "#e3a9b0", art: "suit", condition: "good", price: 38, status: "available" },
  { name: "Emerald Silk Formal Suit", description: "Raw silk kameez with gold zari border and matching trousers. Original tags still attached.", category: "Shalwar Kameez", brand: "Sana Safinaz", size: "M", color: "Green", fabric: "Raw silk", pieces: 3, stitching: "unstitched", occasion: "formal", hex: "#0f5a45", art: "suit", condition: "new_with_tags", price: 95, status: "available", featured: true },
  { name: "Mustard Cotton Printed Suit", description: "Everyday two-piece printed cotton suit with a straight-cut kameez.", category: "Shalwar Kameez", brand: "Gul Ahmed", size: "L", color: "Mustard", fabric: "Cotton", pieces: 2, stitching: "stitched", occasion: "casual", hex: "#d1a02c", art: "suit", condition: "good", price: 24, status: "sold" },
  { name: "Ivory Cotton Straight Kurta", description: "Men's straight kurta in crisp cotton with a buttoned placket. A wardrobe staple.", category: "Kurtas", brand: "Fabindia", size: "M", color: "Ivory", fabric: "Cotton", pieces: 1, stitching: "stitched", occasion: "casual", hex: "#ebe0c8", art: "kurta", condition: "good", price: 22, status: "available" },
  { name: "Indigo Block Print Kurti", description: "Hand block printed short kurti with three-quarter sleeves.", category: "Kurtis", brand: "Biba", size: "S", color: "Indigo", fabric: "Cotton", pieces: 1, stitching: "stitched", occasion: "casual", hex: "#2c3f78", art: "kurta", condition: "like_new", price: 18, status: "available", featured: true },
  { name: "Rust Linen Kurta", description: "Men's relaxed linen kurta with side slits. Slight fading at the cuffs.", category: "Kurtas", brand: "Khaadi", size: "L", color: "Rust", fabric: "Linen", pieces: 1, stitching: "stitched", occasion: "casual", imperfections: "Slight fading at the cuffs and one replaced button.", hex: "#b0502c", art: "kurta", condition: "fair", price: 12, status: "available" },
  { name: "Black Embroidered Kurti", description: "Black cotton kurti with gold thread work at the neckline.", category: "Kurtis", brand: "Limelight", size: "M", color: "Black", fabric: "Cotton", pieces: 1, stitching: "stitched", occasion: "festive", hex: "#2a2526", art: "kurta", condition: "good", price: 16, status: "available" },
  { name: "Mint Green Summer Kurta", description: "Lightweight lawn kurta in a fresh mint shade.", category: "Kurtis", brand: null, size: "L", color: "Green", fabric: "Lawn", pieces: 1, stitching: "stitched", hex: "#a9d1ba", art: "kurta", condition: "good", price: 10, status: "available" },
  { name: "Maroon Velvet Kurta", description: "Rich velvet kurta with antique gold buttons. Dry cleaned.", category: "Kurtis", brand: "Sapphire", size: "M", color: "Maroon", fabric: "Velvet", pieces: 1, stitching: "stitched", occasion: "festive", hex: "#6e1423", art: "kurta", condition: "like_new", price: 34, status: "sold" },
  { name: "Red Bridal Lehenga Choli", description: "Heavily embellished bridal lehenga with matching choli and net dupatta. Worn once for a wedding.", category: "Lehengas", brand: "Maria B", size: "M", color: "Red", fabric: "Net", pieces: 3, stitching: "stitched", occasion: "bridal", imperfections: "A few loose sequins near the hem. Blouse was altered to fit a 36-inch bust.", hex: "#a3182c", art: "lehenga", condition: "like_new", price: 320, status: "available", featured: true, images: 3 },
  { name: "Pastel Peach Party Lehenga", description: "Flared organza lehenga with sequin work and a short-sleeved choli.", category: "Lehengas", brand: "Biba", size: "S", color: "Peach", fabric: "Organza", pieces: 2, stitching: "stitched", occasion: "party", hex: "#f0b89a", art: "lehenga", condition: "good", price: 85, status: "available" },
  { name: "Navy Mirror Work Lehenga", description: "Navy lehenga with mirror work panels and a contrast border.", category: "Lehengas", brand: "W", size: "L", color: "Navy", fabric: "Georgette", pieces: 2, stitching: "stitched", occasion: "party", hex: "#1d2f5c", art: "lehenga", condition: "good", price: 70, status: "draft" },
  { name: "Royal Blue Banarasi Silk Saree", description: "Woven Banarasi silk with a wide gold zari border and rich pallu. Includes blouse piece.", category: "Sarees", brand: "Ritu Kumar", size: "Free size", color: "Blue", fabric: "Banarasi silk", pieces: 2, stitching: "unstitched", occasion: "wedding", imperfections: "None noticed. Blouse piece is uncut.", hex: "#1f3f9a", art: "saree", condition: "like_new", price: 120, status: "available", images: 3 },
  { name: "Mustard Chiffon Saree", description: "Flowing chiffon saree with a slim sequin border. Easy to drape.", category: "Sarees", brand: "Fabindia", size: "Free size", color: "Mustard", fabric: "Chiffon", pieces: 1, occasion: "party", hex: "#d6a22e", art: "saree", condition: "good", price: 40, status: "available" },
  { name: "Purple Kanjivaram Saree", description: "Traditional Kanjivaram silk in deep purple with temple border.", category: "Sarees", brand: null, size: "Free size", color: "Purple", fabric: "Kanjivaram silk", pieces: 1, occasion: "wedding", imperfections: "Small pull in the weave near the pallu.", hex: "#5b2a86", art: "saree", condition: "fair", price: 60, status: "sold" },
  { name: "Wine Floor-Length Anarkali", description: "Georgette anarkali with an embroidered yoke and a full flare.", category: "Anarkalis", brand: "Maria B", size: "M", color: "Wine", fabric: "Georgette", pieces: 1, stitching: "stitched", occasion: "party", hex: "#6a1b3a", art: "anarkali", condition: "good", price: 75, status: "available", featured: true },
  { name: "Emerald Embroidered Anarkali", description: "Fully lined anarkali with zari embroidery, churidar and dupatta.", category: "Anarkalis", brand: "Sana Safinaz", size: "L", color: "Green", fabric: "Chiffon", pieces: 3, stitching: "stitched", occasion: "wedding", hex: "#0f5a45", art: "anarkali", condition: "like_new", price: 110, status: "available", images: 3 },
  { name: "Powder Blue Net Anarkali", description: "Net anarkali with delicate thread work, ideal for mehndi or eid.", category: "Anarkalis", brand: "Limelight", size: "L", color: "Blue", fabric: "Net", pieces: 2, stitching: "stitched", occasion: "festive", hex: "#a9c4e4", art: "anarkali", condition: "good", price: 55, status: "available" },
  { name: "Gold Tissue Anarkali Gown", description: "Tissue silk gown with hand-worked bodice.", category: "Anarkalis", brand: "Elan", size: "S", color: "Gold", fabric: "Tissue silk", pieces: 1, stitching: "stitched", occasion: "bridal", hex: "#c9a24a", art: "anarkali", condition: "good", price: 260, status: "archived" },
  { name: "Ivory Jamawar Sherwani", description: "Classic groom's sherwani in ivory jamawar with gold buttons. Worn once.", category: "Sherwanis", brand: "Manyavar", size: "L", color: "Ivory", fabric: "Jamawar", pieces: 2, stitching: "stitched", occasion: "wedding", hex: "#efe4cc", art: "sherwani", condition: "like_new", price: 180, status: "available" },
  { name: "Black Prince Coat", description: "Tailored prince coat with a stand collar, fully lined.", category: "Sherwanis", brand: "J.", size: "M", color: "Black", fabric: "Wool blend", pieces: 1, stitching: "stitched", occasion: "formal", hex: "#26262a", art: "sherwani", condition: "like_new", price: 90, status: "available" },
  { name: "Gold Kundan Jhumka Earrings", description: "Statement jhumkas with kundan stones and pearl drops.", category: "Jewellery", brand: null, size: null, color: "Gold", hex: "#c9a24a", art: "jhumka", condition: "good", price: 28, status: "available", featured: true },
  { name: "Embroidered Potli Bag", description: "Drawstring potli with zardozi embroidery.", category: "Bags & Shoes", brand: null, size: null, color: null, hex: "#1d3f72", art: "potli", condition: "good", price: 9, status: "available" },
  { name: "Maroon Khussa Shoes", description: "Hand-stitched leather khussas with gold thread work.", category: "Bags & Shoes", brand: null, size: "38", color: "Maroon", hex: "#7a1e2c", art: "khussa", condition: "good", price: 20, status: "draft" },
  { name: "Orange Bandhani Dupatta", description: "Tie-dye bandhani dupatta in vibrant orange with gota edging. Never used.", category: "Dupattas", brand: "Fabindia", size: "Free size", color: "Orange", fabric: "Georgette", pieces: 1, occasion: "festive", hex: "#d97a2b", art: "dupatta", condition: "new_with_tags", price: 16, status: "available" },
  { name: "Pink Phulkari Dupatta", description: "Hand-embroidered phulkari dupatta from Punjab in bright pink.", category: "Dupattas", brand: null, size: "Free size", color: "Pink", fabric: "Cotton", pieces: 1, hex: "#d6457a", art: "dupatta", condition: "good", price: 30, status: "available" },
  { name: "Black Chiffon Formal Suit", description: "Embroidered chiffon suit with sequin work, suitable for evening events.", category: "Shalwar Kameez", brand: "Maria B", size: "L", color: "Black", fabric: "Chiffon", pieces: 3, stitching: "stitched", occasion: "formal", imperfections: "Light wear on the trouser hems.", hex: "#252224", art: "suit", condition: "good", price: 65, status: "available" },
  { name: "Girls Pink Gharara Set", description: "Three-piece gharara set for a girl aged about 6 to 7, with gota trim. Worn once for Eid.", category: "Girls", brand: "Maria B", size: "6-7 years", color: "Pink", fabric: "Cotton net", pieces: 3, stitching: "stitched", occasion: "festive", hex: "#e58fb0", art: "lehenga", condition: "like_new", price: 35, status: "available" },
  { name: "Boys Cream Kurta Pajama", description: "Kurta pajama set for a boy aged about 8 to 9, with a little embroidery on the collar.", category: "Boys", brand: "J.", size: "8-9 years", color: "Cream", fabric: "Cotton", pieces: 2, stitching: "stitched", occasion: "festive", hex: "#efe2c4", art: "suit", condition: "good", price: 22, status: "available" },
];
