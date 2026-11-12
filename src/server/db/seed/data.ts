import type { Condition } from "@/lib/conditions";
import type { GarmentKind } from "./artwork";

export const seedCategories = [
  "Shalwar Kameez",
  "Kurtas",
  "Lehengas",
  "Sarees",
  "Anarkalis",
  "Menswear",
  "Dupattas",
  "Accessories",
];

export type SeedProduct = {
  name: string;
  description: string;
  category: string;
  brand: string | null;
  size: string | null;
  color: string | null;
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
  { name: "Teal Embroidered Lawn Suit", description: "Three-piece lawn suit with thread embroidery on the neckline, matching trousers and a chiffon dupatta. Worn twice.", category: "Shalwar Kameez", brand: "Khaadi", size: "M", color: "Teal", hex: "#1f6f6a", art: "suit", condition: "like_new", price: 45, status: "available", featured: true, images: 3 },
  { name: "Blush Pink Chikankari Suit", description: "Hand-embroidered chikankari kameez in soft cotton with a plain shalwar. Light and breathable.", category: "Shalwar Kameez", brand: "Sapphire", size: "S", color: "Pink", hex: "#e3a9b0", art: "suit", condition: "good", price: 38, status: "available" },
  { name: "Emerald Silk Formal Suit", description: "Raw silk kameez with gold zari border and matching trousers. Original tags still attached.", category: "Shalwar Kameez", brand: "Sana Safinaz", size: "M", color: "Green", hex: "#0f5a45", art: "suit", condition: "new_with_tags", price: 95, status: "available", featured: true },
  { name: "Mustard Cotton Printed Suit", description: "Everyday two-piece printed cotton suit with a straight-cut kameez.", category: "Shalwar Kameez", brand: "Gul Ahmed", size: "L", color: "Mustard", hex: "#d1a02c", art: "suit", condition: "good", price: 24, status: "sold" },
  { name: "Ivory Cotton Straight Kurta", description: "Classic straight kurta in crisp cotton with a buttoned placket. A wardrobe staple.", category: "Kurtas", brand: "Fabindia", size: "M", color: "Ivory", hex: "#ebe0c8", art: "kurta", condition: "good", price: 22, status: "available" },
  { name: "Indigo Block Print Kurti", description: "Hand block printed short kurti with three-quarter sleeves.", category: "Kurtas", brand: "Biba", size: "S", color: "Indigo", hex: "#2c3f78", art: "kurta", condition: "like_new", price: 18, status: "available", featured: true },
  { name: "Rust Linen Kurta", description: "Relaxed linen kurta with side slits. Slight fading at the cuffs.", category: "Kurtas", brand: "Khaadi", size: "L", color: "Rust", hex: "#b0502c", art: "kurta", condition: "fair", price: 12, status: "available" },
  { name: "Black Embroidered Kurti", description: "Black cotton kurti with gold thread work at the neckline.", category: "Kurtas", brand: "Limelight", size: "M", color: "Black", hex: "#2a2526", art: "kurta", condition: "good", price: 16, status: "available" },
  { name: "Mint Green Summer Kurta", description: "Lightweight lawn kurta in a fresh mint shade.", category: "Kurtas", brand: null, size: "L", color: "Green", hex: "#a9d1ba", art: "kurta", condition: "good", price: 10, status: "available" },
  { name: "Maroon Velvet Kurta", description: "Rich velvet kurta with antique gold buttons. Dry cleaned.", category: "Kurtas", brand: "Sapphire", size: "M", color: "Maroon", hex: "#6e1423", art: "kurta", condition: "like_new", price: 34, status: "sold" },
  { name: "Red Bridal Lehenga Choli", description: "Heavily embellished bridal lehenga with matching choli and net dupatta. Worn once for a wedding.", category: "Lehengas", brand: "Maria B", size: "M", color: "Red", hex: "#a3182c", art: "lehenga", condition: "like_new", price: 320, status: "available", featured: true, images: 3 },
  { name: "Pastel Peach Party Lehenga", description: "Flared organza lehenga with sequin work and a short-sleeved choli.", category: "Lehengas", brand: "Biba", size: "S", color: "Peach", hex: "#f0b89a", art: "lehenga", condition: "good", price: 85, status: "available" },
  { name: "Navy Mirror Work Lehenga", description: "Navy lehenga with mirror work panels and a contrast border.", category: "Lehengas", brand: "W", size: "L", color: "Navy", hex: "#1d2f5c", art: "lehenga", condition: "good", price: 70, status: "draft" },
  { name: "Royal Blue Banarasi Silk Saree", description: "Woven Banarasi silk with a wide gold zari border and rich pallu. Includes blouse piece.", category: "Sarees", brand: "Ritu Kumar", size: "Free size", color: "Blue", hex: "#1f3f9a", art: "saree", condition: "like_new", price: 120, status: "available", images: 3 },
  { name: "Mustard Chiffon Saree", description: "Flowing chiffon saree with a slim sequin border. Easy to drape.", category: "Sarees", brand: "Fabindia", size: "Free size", color: "Mustard", hex: "#d6a22e", art: "saree", condition: "good", price: 40, status: "available" },
  { name: "Purple Kanjivaram Saree", description: "Traditional Kanjivaram silk in deep purple with temple border.", category: "Sarees", brand: null, size: "Free size", color: "Purple", hex: "#5b2a86", art: "saree", condition: "fair", price: 60, status: "sold" },
  { name: "Wine Floor-Length Anarkali", description: "Georgette anarkali with an embroidered yoke and a full flare.", category: "Anarkalis", brand: "Maria B", size: "M", color: "Wine", hex: "#6a1b3a", art: "anarkali", condition: "good", price: 75, status: "available", featured: true },
  { name: "Emerald Embroidered Anarkali", description: "Fully lined anarkali with zari embroidery, churidar and dupatta.", category: "Anarkalis", brand: "Sana Safinaz", size: "L", color: "Green", hex: "#0f5a45", art: "anarkali", condition: "like_new", price: 110, status: "available", images: 3 },
  { name: "Powder Blue Net Anarkali", description: "Net anarkali with delicate thread work, ideal for mehndi or eid.", category: "Anarkalis", brand: "Limelight", size: "L", color: "Blue", hex: "#a9c4e4", art: "anarkali", condition: "good", price: 55, status: "available" },
  { name: "Gold Tissue Anarkali Gown", description: "Tissue silk gown with hand-worked bodice.", category: "Anarkalis", brand: "Elan", size: "S", color: "Gold", hex: "#c9a24a", art: "anarkali", condition: "good", price: 260, status: "archived" },
  { name: "Ivory Jamawar Sherwani", description: "Classic groom's sherwani in ivory jamawar with gold buttons. Worn once.", category: "Menswear", brand: "Manyavar", size: "L", color: "Ivory", hex: "#efe4cc", art: "sherwani", condition: "like_new", price: 180, status: "available" },
  { name: "Black Prince Coat", description: "Tailored prince coat with a stand collar, fully lined.", category: "Menswear", brand: "J.", size: "M", color: "Black", hex: "#26262a", art: "sherwani", condition: "like_new", price: 90, status: "available" },
  { name: "Gold Kundan Jhumka Earrings", description: "Statement jhumkas with kundan stones and pearl drops.", category: "Accessories", brand: null, size: null, color: "Gold", hex: "#c9a24a", art: "jhumka", condition: "good", price: 28, status: "available", featured: true },
  { name: "Embroidered Potli Bag", description: "Drawstring potli with zardozi embroidery.", category: "Accessories", brand: null, size: null, color: null, hex: "#1d3f72", art: "potli", condition: "good", price: 9, status: "available" },
  { name: "Maroon Khussa Shoes", description: "Hand-stitched leather khussas with gold thread work.", category: "Accessories", brand: null, size: "38", color: "Maroon", hex: "#7a1e2c", art: "khussa", condition: "good", price: 20, status: "draft" },
  { name: "Orange Bandhani Dupatta", description: "Tie-dye bandhani dupatta in vibrant orange with gota edging. Never used.", category: "Dupattas", brand: "Fabindia", size: "Free size", color: "Orange", hex: "#d97a2b", art: "dupatta", condition: "new_with_tags", price: 16, status: "available" },
  { name: "Pink Phulkari Dupatta", description: "Hand-embroidered phulkari dupatta from Punjab in bright pink.", category: "Dupattas", brand: null, size: "Free size", color: "Pink", hex: "#d6457a", art: "dupatta", condition: "good", price: 30, status: "available" },
  { name: "Black Chiffon Formal Suit", description: "Embroidered chiffon suit with sequin work, suitable for evening events.", category: "Shalwar Kameez", brand: "Maria B", size: "L", color: "Black", hex: "#252224", art: "suit", condition: "good", price: 65, status: "available" },
];
