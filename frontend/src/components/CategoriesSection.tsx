import React from 'react';
import { ArrowRight, Grid } from 'lucide-react';
import { Category, Product } from '../types';

interface CategoriesSectionProps {
  categories: Category[];
  products: Product[];
  selectedCategory: string | null;
  onSelectCategory: (categoryName: string | null) => void;
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  categories,
  products,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section id="categories" className="py-14 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <Grid className="w-3.5 h-3.5" />
              <span>Aisle by Aisle</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Featured Categories
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select any aisle to filter products, check subcategories and add to your cart.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedCategory && (
              <button
                onClick={() => onSelectCategory(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Clear Filter (Show All)
              </button>
            )}
            <button
              onClick={() => onSelectCategory(null)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View all {products.length} products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 sm:gap-4">
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            const isSelected = selectedCategory === cat.name;

            return (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(isSelected ? null : cat.name)}
                className={`p-4 rounded-2xl flex flex-col items-center text-center transition-all duration-200 cursor-pointer border group active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-emerald-300 shadow-2xs hover:shadow-md'
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-2.5 transition-transform duration-300 group-hover:scale-110 ${
                  isSelected ? 'bg-emerald-200/60' : 'bg-slate-100/80 group-hover:bg-emerald-100/50'
                }`}>
                  {cat.icon}
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">
                  {cat.name}
                </h4>
                <span className="text-[10px] font-semibold text-slate-400 mt-1">
                  {count} items
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
};
