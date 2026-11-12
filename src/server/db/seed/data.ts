import type { Condition } from "@/lib/conditions";
import type { GarmentKind } from "./artwork";

export const seedCategories = [
  "Dresses",
  "Shirts",
  "Tops",
  "Pants",
  "Jeans",
  "Jackets",
  "Shoes",
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
  { name: "Black Midi Wrap Dress", description: "Classic wrap silhouette in a soft, drapey fabric. Falls just below the knee. Worn twice.", category: "Dresses", brand: "Zara", size: "M", color: "Black", hex: "#2b2b2e", art: "dress", condition: "like_new", price: 28, status: "available", featured: true, images: 3 },
  { name: "Floral Summer Dress", description: "Lightweight sleeveless dress with a small floral print. Fully lined.", category: "Dresses", brand: "H&M", size: "S", color: "Rose", hex: "#d9a3a0", art: "dress", condition: "good", price: 18, status: "available" },
  { name: "Emerald Satin Slip Dress", description: "Bias-cut satin slip dress with adjustable straps. Original tags still attached.", category: "Dresses", brand: "Mango", size: "M", color: "Green", hex: "#2f6b55", art: "dress", condition: "new_with_tags", price: 42, status: "available", featured: true },
  { name: "Linen Shirt Dress", description: "Relaxed linen dress with a button front and side pockets.", category: "Dresses", brand: "Uniqlo", size: "L", color: "Beige", hex: "#d8c7a8", art: "dress", condition: "good", price: 24, status: "sold" },
  { name: "Oxford Button-Down Shirt", description: "Crisp cotton oxford shirt. A wardrobe staple with plenty of life left.", category: "Shirts", brand: "Ralph Lauren", size: "M", color: "Light blue", hex: "#a9c1dc", art: "shirt", condition: "good", price: 26, status: "available" },
  { name: "White Poplin Shirt", description: "Oversized fit, dropped shoulders. Bright white with no marks.", category: "Shirts", brand: "COS", size: "S", color: "White", hex: "#f4f1ea", art: "shirt", condition: "like_new", price: 30, status: "available", featured: true },
  { name: "Checked Flannel Shirt", description: "Soft brushed flannel in a red check. Slight fading at the cuffs.", category: "Shirts", brand: "Levi's", size: "L", color: "Red", hex: "#a8483f", art: "shirt", condition: "fair", price: 12, status: "available" },
  { name: "Striped Breton Top", description: "Long-sleeve cotton top with navy stripes.", category: "Tops", brand: "Mango", size: "M", color: "Navy", hex: "#2e3f5c", art: "top", condition: "good", price: 14, status: "available" },
  { name: "Ribbed Knit Tank", description: "Fitted ribbed tank in a warm sand colour.", category: "Tops", brand: "Zara", size: "S", color: "Sand", hex: "#cfb596", art: "top", condition: "like_new", price: 10, status: "available" },
  { name: "Silk Blend Blouse", description: "Fluid blouse with a subtle sheen. Dry cleaned.", category: "Tops", brand: "Massimo Dutti", size: "M", color: "Ivory", hex: "#ece4d4", art: "top", condition: "like_new", price: 34, status: "sold" },
  { name: "Graphic Cotton Tee", description: "Soft cotton tee, relaxed fit.", category: "Tops", brand: null, size: "L", color: "Grey", hex: "#9a9a98", art: "top", condition: "good", price: 8, status: "available" },
  { name: "Tailored Wide-Leg Trousers", description: "High-waisted trousers with a pressed crease and a wide leg.", category: "Pants", brand: "Massimo Dutti", size: "M", color: "Camel", hex: "#b8926a", art: "pants", condition: "like_new", price: 36, status: "available", featured: true },
  { name: "Black Cigarette Pants", description: "Slim ankle-length trousers with a little stretch.", category: "Pants", brand: "Zara", size: "S", color: "Black", hex: "#2a2a2c", art: "pants", condition: "good", price: 20, status: "available" },
  { name: "Olive Cargo Pants", description: "Relaxed cargo trousers with utility pockets.", category: "Pants", brand: "H&M", size: "L", color: "Olive", hex: "#6b6f4d", art: "pants", condition: "good", price: 19, status: "draft" },
  { name: "501 Original Straight Jeans", description: "The classic straight leg in a mid-blue wash. Nicely broken in.", category: "Jeans", brand: "Levi's", size: "30", color: "Blue", hex: "#5b7da3", art: "jeans", condition: "good", price: 38, status: "available", images: 3 },
  { name: "High-Rise Skinny Jeans", description: "Dark indigo skinny jeans with good stretch recovery.", category: "Jeans", brand: "Zara", size: "28", color: "Indigo", hex: "#2f3f5e", art: "jeans", condition: "like_new", price: 22, status: "available" },
  { name: "Vintage Mom Jeans", description: "Light-wash high-waisted jeans with a tapered leg.", category: "Jeans", brand: "Levi's", size: "32", color: "Light blue", hex: "#a7bdd3", art: "jeans", condition: "fair", price: 16, status: "sold" },
  { name: "Classic Denim Jacket", description: "Trucker-style denim jacket in a mid wash.", category: "Jackets", brand: "Levi's", size: "M", color: "Blue", hex: "#5f81a8", art: "jacket", condition: "good", price: 45, status: "available", featured: true },
  { name: "Wool Blend Blazer", description: "Single-breasted blazer, fully lined, with structured shoulders.", category: "Jackets", brand: "Mango", size: "L", color: "Charcoal", hex: "#4a4b4f", art: "jacket", condition: "like_new", price: 55, status: "available", images: 3 },
  { name: "Quilted Puffer Jacket", description: "Warm quilted jacket with a stand collar.", category: "Jackets", brand: "Uniqlo", size: "L", color: "Olive", hex: "#63694b", art: "jacket", condition: "good", price: 40, status: "available" },
  { name: "Suede Biker Jacket", description: "Soft suede with an asymmetric zip.", category: "Jackets", brand: "AllSaints", size: "S", color: "Tan", hex: "#b08458", art: "jacket", condition: "good", price: 95, status: "archived" },
  { name: "White Leather Sneakers", description: "Minimal leather sneakers. Soles cleaned, light creasing on the toe.", category: "Shoes", brand: "Adidas", size: "39", color: "White", hex: "#f2efe8", art: "shoes", condition: "good", price: 32, status: "available" },
  { name: "Tan Leather Loafers", description: "Penny loafers in polished tan leather.", category: "Shoes", brand: "Clarks", size: "38", color: "Tan", hex: "#a8703f", art: "shoes", condition: "like_new", price: 44, status: "available" },
  { name: "Leather Tote Bag", description: "Roomy tote with an inner zip pocket.", category: "Accessories", brand: "Coach", size: null, color: "Brown", hex: "#7a4f33", art: "bag", condition: "good", price: 78, status: "available", featured: true },
  { name: "Canvas Shopper", description: "Sturdy everyday canvas bag.", category: "Accessories", brand: null, size: null, color: null, hex: "#d9cfbd", art: "bag", condition: "good", price: 9, status: "available" },
  { name: "Burgundy Knit Dress", description: "Ribbed knit midi dress with long sleeves.", category: "Dresses", brand: "COS", size: "S", color: "Burgundy", hex: "#6e2b36", art: "dress", condition: "like_new", price: 48, status: "draft" },
  { name: "Terracotta Linen Top", description: "Boxy linen top with short sleeves. Perfect for warm days.", category: "Tops", brand: "Uniqlo", size: "M", color: "Terracotta", hex: "#b5654a", art: "top", condition: "new_with_tags", price: 16, status: "available" },
  { name: "Little Black Dress", description: "Sleeveless shift dress that works for any occasion.", category: "Dresses", brand: "Mango", size: "L", color: "Black", hex: "#252527", art: "dress", condition: "good", price: 29, status: "available" },
];
