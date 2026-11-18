import type { Product } from '../types';

function base() {
  return (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

const ICONS: Record<string, string> = {
  'Fruits & Vegetables': '🥦', Dairy: '🥛', 'Snacks & Biscuits': '🍪', Beverages: '🥤', Commodities: '🌾',
  'Bakery & Breakfast': '🥖', 'Meat and Sea Food': '🍗', 'Personal Care': '🧴', 'Spices & Sauces': '🌶️',
};

export interface CatalogCategory { name: string; icon: string; subcategories: string[] }

export async function fetchCatalog(): Promise<Product[]> {
  const res = await fetch(`${base()}/catalog/products`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`catalog -> HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || []).map((p: any) => {
    const category = p.category || p.family || 'Other';
    const search = [p.name, p.size, p.brand, p.brand_ur, ...(p.aliases || [])].filter(Boolean).join(' ').toLowerCase();
    return {
      id: String(p.id),
      name: p.name,
      category,
      subcategory: p.family || category,
      size: p.size || '',
      price: p.price ?? null,
      stock: p.stock ?? null,
      icon: ICONS[category] || '🛒',
      image: p.image_url || '',
      search,
    } as unknown as Product;
  });
}

// Category list built from the products (new categories the admin adds appear automatically).
export function buildCategories(products: Product[], order: CatalogCategory[]): CatalogCategory[] {
  const map = new Map<string, CatalogCategory>();
  order.forEach((c) => map.set(c.name, { ...c, subcategories: [] }));
  products.forEach((p: any) => {
    if (!map.has(p.category)) map.set(p.category, { name: p.category, icon: p.icon || '🛒', subcategories: [] });
    const c = map.get(p.category)!;
    if (p.subcategory && !c.subcategories.includes(p.subcategory)) c.subcategories.push(p.subcategory);
  });
  return [...map.values()].filter((c) => c.subcategories.length > 0);
}