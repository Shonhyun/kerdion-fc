export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'pc';
export type Lang = 'en' | 'tl';

export interface PriceSnap { d: string; t: number; price: string; qty: string; unit: string }

/** Something you buy: an ingredient or packaging, saved once and shared by all products. */
export interface LibItem {
  id: string;
  cat: 'ing' | 'pack';
  name: string;
  price: string;
  qty: string;
  unit: string;
  yield: string;
  history: PriceSnap[];
}

/** One item used in a product or sub-recipe. `q` holds per-size amounts when the product has sizes. */
export interface Line { id: string; ref: string; qty: string; unit: string; q?: Record<string, string> }

export interface Prep { id: string; name: string; makes: string; unit: string; items: Line[] }

export interface Size { id: string; name: string; price: string; orders: string }

export interface Recipe {
  id: string;
  kind: 'product' | 'addon';
  name: string;
  mode: 'margin' | 'price';
  margin: string;
  price: string;
  benchmark: string;
  orders: string;
  items: Line[];
  sizes: Size[];
}

export interface ComboItem { id: string; rid: string; qty: string }
export interface Combo { id: string; name: string; price: string; orders: string; items: ComboItem[] }
export interface Fixed { id: string; name: string; amount: string }

export interface PriceAlert {
  id: string; lid: string; name: string; from: string; to: string; up: boolean;
  delta: number; sugg: string[]; d: string; products: string[];
}

export interface Biz {
  name: string; daysOpen: string; taxOn: boolean; taxRate: string;
  deliveryOn: boolean; deliveryRate: string; round: string;
}

export interface AppData {
  v: number;
  lang: Lang;
  sample: boolean;
  bannerHidden: boolean;
  onboarded: boolean;
  goal: string;
  lastBackup: number;
  biz: Biz;
  library: LibItem[];
  preps: Prep[];
  recipes: Recipe[];
  combos: Combo[];
  fixed: Fixed[];
  log: Record<string, Record<string, string>>;
  alerts: PriceAlert[];
  ups: { main: string; addon: string; pct: string };
}

/** A sellable unit: a product, or one size of a product. key = recipeId or recipeId~sizeId */
export interface SellUnit { key: string; r: Recipe; s: Size | null; name: string }

export interface Calc {
  ing: number; pack: number; cost: number; pre: number; sell: number; tax: number;
  profit: number; foodPct: number; margin: number;
}
