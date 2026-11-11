import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Mic,
  X,
  User as UserIcon,
  Camera,
  Heart,
  Home,
  Store,
  Menu,
  Info,
  Headphones,
  ChevronRight,
} from 'lucide-react';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentView]);

  const suggestions =
    searchTerm.trim().length > 1
      ? products
          .filter(
            (product) =>
              product.search.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const navigateSection = (sectionId: string) => {
    setIsMenuOpen(false);
    onNavigateSection(sectionId);
  };

  const navItems = [
    { label: 'Home', section: 'home', icon: Home },
    { label: 'About Us', section: 'about', icon: Info },
    { label: 'Services', section: 'services', icon: Store },
    { label: 'Contact Us', section: 'contact', icon: Headphones },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-[#e5eee8] transition-all duration-300 ${
        isScrolled ? 'shadow-lg shadow-emerald-950/[0.06]' : ''
      }`}
    >
      <div className="max-w-[1480px] mx-auto px-3 sm:px-5 xl:px-8">
        <div className="min-h-[72px] flex items-center justify-between gap-3">

          {/* Brand */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);

              if (currentView !== 'landing') {
                onNavigateView('landing');
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="shrink-0 flex items-center"
            aria-label="AssaanMart home"
          >
            <AnimatedBrand playKey={logoPlayKey} />
          </button>

          {/* Desktop Landing Navigation */}
          {currentView === 'landing' && (
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
              {navItems.map((item) => (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => navigateSection(item.section)}
                  className="relative py-2 text-[13px] font-semibold text-[#496454] hover:text-[#21804e] transition-colors group"
                >
                  {item.label}
                  <span className="absolute left-0 -bottom-0.5 w-0 h-[2px] bg-[#4c9b68] rounded-full group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </nav>
          )}

          {/* Desktop Dashboard Search */}
          {currentView === 'dashboard' && (
            <div
              ref={searchContainerRef}
              className="relative hidden md:block flex-1 max-w-[430px] mx-4"
            >
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-[17px] h-[17px] text-[#55936b] pointer-events-none" />

                <input
                  type="text"
                  placeholder="Search groceries, fruits, beverages..."
                  value={searchTerm}
                  onChange={(event) => {
                    onSearchChange(event.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  className="w-full rounded-full border border-[#dcebe0] bg-[#f5faf6] py-3 pl-11 pr-10 text-sm text-[#254b36] placeholder:text-[#91a698] outline-none transition-all focus:border-[#80b995] focus:bg-white focus:ring-4 focus:ring-[#4c9b68]/10"
                />

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-4 text-[#91a698] hover:text-[#315d40]"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {showSearchSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-[#e2eee5] bg-white shadow-2xl shadow-emerald-950/10">
                  <div className="flex justify-between bg-[#f3f9f4] px-4 py-3 text-xs font-bold text-[#477454]">
                    <span>Search Results</span>
                    <span>{suggestions.length} items</span>
                  </div>

                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onSelectProduct(product);
                        setShowSearchSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-t border-[#f0f5f1] px-4 py-3 text-left transition-colors hover:bg-[#f5faf6]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#304c3a]">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-[#829889]">
                          {product.category} · {product.size}
                        </p>
                      </div>

                      <span className="whitespace-nowrap text-sm font-bold text-[#398052]">
                        {product.price != null
                          ? `PKR ${product.price}`
                          : 'Available'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right Side Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">

            {/* Shop Button */}
            {currentView === 'landing' && (
              <button
                type="button"
                onClick={() => onNavigateView('dashboard')}
                className="hidden sm:flex items-center gap-2 rounded-full bg-[#26764a] px-4 lg:px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#26764a]/15 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1b603b] hover:shadow-lg active:scale-95"
              >
                <Store size={16} />
                Shop Now
              </button>
            )}

            {/* Voice */}
            <button
              type="button"
              onClick={onOpenVoice}
              title="Voice Grocery Ordering"
              aria-label="Open voice ordering"
              className="flex items-center gap-2 rounded-full border border-[#dceee1] bg-[#eff8f1] px-2.5 sm:px-3.5 py-2.5 text-xs font-bold text-[#28764b] transition-all hover:bg-[#e1f1e5] hover:shadow-sm"
            >
              <Mic size={17} />
              <span className="hidden xl:inline">Voice Order</span>
            </button>

            {/* Image Scanner */}
            <button
              type="button"
              onClick={onOpenImageScanner}
              title="Upload Grocery Photo"
              aria-label="Upload grocery photo"
              className="flex items-center gap-2 rounded-full border border-[#e0ebe3] bg-white px-2.5 sm:px-3.5 py-2.5 text-xs font-bold text-[#477354] transition-all hover:border-[#b8d7c0] hover:bg-[#f3f9f4]"
            >
              <Camera size={17} />
              <span className="hidden xl:inline">Upload Photo</span>
            </button>

            {/* Authentication */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <span className="hidden 2xl:block max-w-[90px] truncate text-xs font-bold text-[#315d40]">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-[#718276] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                aria-label="Sign in"
                className="flex items-center gap-1.5 rounded-full px-2 sm:px-3 py-2.5 text-xs font-bold text-[#315d40] transition-colors hover:bg-[#f0f8f2]"
              >
                <UserIcon size={17} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Favourites */}
            <button
              type="button"
              onClick={onOpenFavorites}
              aria-label="My favourites"
              title="My favourites"
              className="relative rounded-full border border-[#f0dfe3] p-2.5 text-rose-500 transition-all hover:bg-rose-50"
            >
              <Heart
                size={17}
                className={favoritesCount > 0 ? 'fill-rose-500' : ''}
              />

              {favoritesCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              ref={cartBtnRef}
              type="button"
              onClick={onOpenCart}
              aria-label="View cart"
              className="relative rounded-full bg-[#26764a] p-2.5 text-white shadow-md shadow-[#26764a]/15 transition-all hover:-translate-y-0.5 hover:bg-[#1b603b] active:scale-95"
            >
              <span
                key={cartHit}
                className={`db-cart-ico ${cartHit ? 'hit' : ''}`}
              >
                <ShoppingCart size={17} />
              </span>

              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-rose-500 px-1 text-[9px] font-bold text-white"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            {currentView === 'landing' && (
              <button
                type="button"
                onClick={() => setIsMenuOpen((previous) => !previous)}
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMenuOpen}
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-[#dcebe0] bg-white text-[#28764b] transition-all hover:bg-[#eff8f1] lg:hidden"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dashboard Search */}
        {currentView === 'dashboard' && (
          <div ref={searchContainerRef} className="relative pb-3 md:hidden">
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-4 w-4 text-[#55936b]" />
              <input
                type="text"
                placeholder="Search your groceries..."
                value={searchTerm}
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                className="w-full rounded-full border border-[#dcebe0] bg-[#f5faf6] py-2.5 pl-11 pr-10 text-sm text-[#254b36] outline-none focus:border-[#80b995] focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-4 text-[#91a698]"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {showSearchSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-[#e2eee5] bg-white shadow-xl">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(product);
                      setShowSearchSuggestions(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#f0f5f1] px-4 py-3 text-left hover:bg-[#f5faf6]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#304c3a]">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#829889]">
                        {product.category} · {product.size}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-[#398052]">
                      {product.price != null ? `PKR ${product.price}` : 'Available'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobile Landing Menu */}
        {currentView === 'landing' && (
          <div
            className={`grid transition-all duration-300 ease-in-out lg:hidden ${
              isMenuOpen
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <nav className="border-t border-[#edf2ee] py-3">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.section}
                      type="button"
                      onClick={() => navigateSection(item.section)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#45634f] transition-colors hover:bg-[#f1f8f2] hover:text-[#26764a]"
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={17} className="text-[#5b9a6d]" />
                        {item.label}
                      </span>
                      <ChevronRight size={16} className="text-[#9ab3a0]" />
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigateView('dashboard');
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#26764a] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1b603b]"
                >
                  <Store size={17} />
                  Explore Grocery Store
                </button>

                {user && (
                  <div className="mt-3 flex items-center justify-between border-t border-[#edf2ee] px-3 pt-3 sm:hidden">
                    <span className="max-w-[160px] truncate text-xs font-semibold text-[#45634f]">
                      Signed in as {user.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="text-xs font-bold text-rose-500"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};