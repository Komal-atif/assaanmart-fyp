import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, Mic, X, User as UserIcon, Store, Camera, Heart } from 'lucide-react';
import { User, Product } from '../types';
import { AnimatedBrand } from './AnimatedBrand';

interface HeaderProps {
  currentView: 'landing' | 'dashboard';
  onNavigateView: (view: 'landing' | 'dashboard') => void;
  user: User | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenVoice: () => void;
  onOpenImageScanner: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectCategory: (category: string | null) => void;
  onNavigateSection: (sectionId: string) => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  cartHit: number;
  favoritesCount?: number;
  onOpenFavorites?: () => void;
  cartBtnRef: React.RefObject<HTMLButtonElement | null>;
  /** change this number to replay the logo intro (page change / modal closed) */
  logoPlayKey?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigateView,
  user,
  cartCount,
  onOpenCart,
  onOpenVoice,
  onOpenImageScanner,
  onOpenAuth,
  onLogout,
  searchTerm,
  onSearchChange,
  onNavigateSection,
  products,
  onSelectProduct,
  cartHit,
  favoritesCount = 0,
  onOpenFavorites,
  cartBtnRef,
  logoPlayKey = 0,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = searchTerm.trim().length > 1
    ? products
        .filter((p) => p.search.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-40 w-full bg-white transition-all duration-200 border-b border-[#e6f4ed]">
      {/* Compact single-line Main Navbar */}
      <div className={`transition-all ${isScrolled ? 'shadow-sm bg-white/95 backdrop-blur-md' : 'bg-white'}`}>
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          
          {/* Logo Brand + "Smart Voice Online Groceries" on a single horizontal line */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // If on landing, scroll to top
                if (currentView === 'landing') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-2 text-left cursor-pointer shrink-0"
            >
              <AnimatedBrand playKey={logoPlayKey} />
            </button>

            {/* Single line tag: Smart Voice Online Groceries */}
            <span className="hidden md:inline-block text-[11px] font-semibold text-[#4b6b60] bg-[#f0fdf4] px-2.5 py-1 rounded-full border border-[#d1fae5] whitespace-nowrap">
              Smart Voice &amp; Online Groceries
            </span>
          </div>

          {/* Navigation Links (Only on Landing Page) */}
          {currentView === 'landing' && (
            <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-[#064e3b]">
              <button
                onClick={() => onNavigateSection('how-it-works')}
                className="hover:text-[#059669] transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                onClick={() => onNavigateSection('faq')}
                className="hover:text-[#059669] transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </nav>
          )}

          {/* Search Bar with Autocomplete Suggestions */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-xs hidden sm:block">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-emerald-600 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSearchSuggestions(true);
                  if (currentView !== 'dashboard') {
                    onNavigateView('dashboard');
                  }
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                className="w-full pl-8 pr-8 py-1.5 bg-[#f0fdf4] border border-[#d1fae5] rounded-full text-xs text-[#064e3b] placeholder-[#059669]/60 focus:outline-hidden focus:bg-white focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSearchSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-emerald-100 overflow-hidden z-50">
                <div className="p-1.5 border-b border-emerald-50 text-[10px] font-semibold text-emerald-800 px-3 flex items-center justify-between bg-[#f0fdf4]">
                  <span>Matches</span>
                  <span>{suggestions.length} items</span>
                </div>
                <div className="divide-y divide-emerald-50 max-h-60 overflow-y-auto">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProduct(p);
                        setShowSearchSuggestions(false);
                      }}
                      className="w-full p-2 px-3 flex items-center justify-between gap-2 hover:bg-[#ecfdf5] text-left transition-colors cursor-pointer text-xs"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-emerald-700/70">
                          {p.category} · {p.size}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#059669] whitespace-nowrap">
                        {p.price ? `PKR ${p.price}` : 'Available'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            
            {/* Prominent Upload Grocery Photo Button */}
            <button
              onClick={onOpenImageScanner}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-gradient-to-r from-[#064e3b] to-[#059669] hover:from-[#043d2e] hover:to-[#047857] text-white font-bold text-xs shadow-md shadow-emerald-950/20 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Upload photo of your handwritten grocery list or kitchen note"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Camera className="w-3 h-3 text-white" />
              </div>
              <span className="hidden sm:inline">Upload Grocery Photo</span>
              <span className="sm:hidden">Upload Photo</span>
            </button>

            {/* Voice Assistant Button */}
            <button
              onClick={onOpenVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0fdf4] hover:bg-[#d1fae5] text-[#064e3b] font-semibold text-xs transition-colors cursor-pointer border border-[#d1fae5] active:scale-95"
              title="Voice Ordering"
            >
              <Mic className="w-3.5 h-3.5 text-[#064e3b]" />
              <span className="hidden sm:inline">Voice</span>
            </button>

            {/* User Profile / Login */}
            {user ? (
              <div className="flex items-center gap-1.5 pl-1">
                <span className="text-[11px] font-bold text-[#064e3b] hidden sm:inline truncate max-w-[80px]">
                  {user.name}
                </span>
                <button
                  onClick={onLogout}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#064e3b] hover:text-[#059669] hover:bg-[#f0fdf4] rounded-full transition-colors cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Favourites */}
            <button
              onClick={onOpenFavorites}
              className="relative p-2 rounded-full bg-white border border-[#d1fae5] text-rose-500 hover:bg-rose-50 transition-all cursor-pointer active:scale-95"
              aria-label="My favourites"
              title="My favourites"
            >
              <Heart className={`w-4 h-4 ${favoritesCount > 0 ? 'fill-rose-500' : ''}`} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-4 h-4 rounded-full flex items-center justify-center px-1 shadow-xs border border-white">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              ref={cartBtnRef}
              onClick={onOpenCart}
              className="relative p-2 rounded-full bg-[#064e3b] text-white hover:bg-[#047857] transition-all cursor-pointer shadow-xs active:scale-95"
              aria-label="View Cart"
            >
              <span key={cartHit} className={`db-cart-ico ${cartHit ? 'hit' : ''}`}>
                <ShoppingCart className="w-4 h-4" />
              </span>
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute -top-1.5 -right-1.5 bg-[#ef4444] text-white font-black text-[10px] min-w-4 h-4 rounded-full flex items-center justify-center px-1 shadow-xs border border-white"
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};