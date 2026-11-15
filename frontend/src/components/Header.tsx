import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, Mic, X, User as UserIcon, Camera, Heart, ListOrdered, LogOut, Phone, Mail, MapPin } from 'lucide-react';
import { User, Product } from '../types';
import { AnimatedBrand } from './AnimatedBrand';

export type AppView = 'landing' | 'dashboard' | 'services' | 'contact';

interface HeaderProps {
  currentView: AppView;
  onNavigateView: (view: AppView) => void;
  user: User | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenVoice: () => void;
  onOpenImageScanner: () => void;
  onOpenAuth: () => void;
  onOpenOrders?: () => void;
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

// an item with `section` scrolls to that part of the store page instead of opening a page
type NavItem = { key: string; view?: AppView; section?: string; label: string };
// store pages
const DASH_NAV: NavItem[] = [
  { key: 'store', view: 'dashboard', label: 'Store' },
  { key: 'services', view: 'services', label: 'Services' },
  { key: 'contact', view: 'contact', label: 'Contact Us' },
];
// landing page: How it works scrolls to its section on the same page
const LAND_NAV: NavItem[] = [
  { key: 'how', section: 'how-it-works', label: 'How it works' },
  { key: 'services', view: 'services', label: 'Services' },
  { key: 'contact', view: 'contact', label: 'Contact Us' },
];

const initialsOf = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigateView,
  user,
  cartCount,
  onOpenCart,
  onOpenVoice,
  onOpenImageScanner,
  onOpenAuth,
  onOpenOrders,
  onLogout,
  onNavigateSection,
  searchTerm,
  onSearchChange,
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
  const [accountOpen, setAccountOpen] = useState(false); // account circle menu
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      const inSearch = searchContainerRef.current?.contains(t) || mobileSearchRef.current?.contains(t);
      if (!inSearch) setShowSearchSuggestions(false);
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // closing the menus whenever the page changes
  useEffect(() => { setAccountOpen(false); }, [currentView]);

  const suggestions = searchTerm.trim().length > 1
    ? products
        .filter((p) => p.search.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 5)
    : [];

  const go = (view: AppView) => {
    onNavigateView(view);
    setAccountOpen(false);
  };
  const goNav = (n: { view?: AppView; section?: string }) => {
    if (n.section) { onNavigateSection(n.section); setAccountOpen(false); }
    else if (n.view) go(n.view);
  };
  const isLanding = currentView === 'landing';
  const nav = isLanding ? LAND_NAV : DASH_NAV;
  const isActive = (n: { view?: AppView }) => Boolean(n.view) && currentView === n.view;

  const searchBox = (mobile: boolean) => (
    <div ref={mobile ? mobileSearchRef : searchContainerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-[#148a4c] absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setShowSearchSuggestions(true);
            if (currentView !== 'dashboard') onNavigateView('dashboard');
          }}
          onFocus={() => setShowSearchSuggestions(true)}
          className={`w-full pl-10 ${mobile ? 'pr-[5.6rem] py-2.5 text-sm' : 'pr-9 py-1.5 text-xs'} bg-[#f3fbf6] border border-[#e0f4e7] rounded-full text-[#2a6b43] placeholder-[#148a4c]/70 focus:outline-hidden focus:bg-white focus:border-[#3fc27b] focus:ring-2 focus:ring-[#3fc27b]/20 transition-all`}
        />
        {mobile ? (
          <div className="absolute right-1.5 flex items-center gap-1">
            {searchTerm && (
              <button onClick={() => onSearchChange('')} className="w-7 h-7 rounded-full text-[#4d7a5c] hover:bg-[#e0f4e7] flex items-center justify-center cursor-pointer" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={onOpenVoice} className="w-8 h-8 rounded-full bg-white border border-[#b3e4c4] text-[#148a4c] flex items-center justify-center active:scale-95 cursor-pointer" aria-label="Voice ordering" title="Voice ordering">
              <Mic className="w-4 h-4" />
            </button>
            <button onClick={onOpenImageScanner} className="w-8 h-8 rounded-full bg-gradient-to-r from-[#1daa61] to-[#3fc27b] text-white flex items-center justify-center active:scale-95 cursor-pointer" aria-label="Upload grocery photo" title="Upload grocery photo">
              <Camera className="w-4 h-4" />
            </button>
          </div>
        ) : (
          searchTerm && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {showSearchSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-[#e0f4e7] overflow-hidden z-50">
          <div className="p-1.5 border-b border-[#f3fbf6] text-[10px] font-semibold text-[#0f6e3d] px-3 flex items-center justify-between bg-[#f3fbf6]">
            <span>Matches</span>
            <span>{suggestions.length} items</span>
          </div>
          <div className="divide-y divide-[#f3fbf6] max-h-60 overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelectProduct(p); setShowSearchSuggestions(false); }}
                className="w-full p-2 px-3 flex items-center justify-between gap-2 hover:bg-[#f3fbf6] text-left transition-colors cursor-pointer text-xs"
              >
                <div className="truncate">
                  <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-[#0f6e3d]/70">{p.category} · {p.size}</p>
                </div>
                <span className="text-xs font-bold text-[#148a4c] whitespace-nowrap">{p.price ? `PKR ${p.price}` : 'Available'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#e0f4e7]">
      <div className={`transition-all ${isScrolled ? 'shadow-sm bg-white/95 backdrop-blur-md' : 'bg-white'}`}>
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">

          {/* logo */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => (isLanding ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go('landing'))}
              className="flex items-center gap-2 text-left cursor-pointer shrink-0"
              aria-label="AssanMart home"
            >
              <AnimatedBrand playKey={logoPlayKey} />
            </button>
          </div>

          {/* desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-[13px] font-semibold">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => goNav(n)}
                className={`group relative px-3 py-2 whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                  isActive(n) ? 'text-[#1DAA61]' : 'text-[#4d7a5c] hover:text-[#1DAA61]'
                }`}
              >
                {n.label}
                {/* underline: green when selected, amber while hovering another item */}
                <span
                  className={`pointer-events-none absolute left-3 right-3 bottom-0 h-[3px] rounded-full origin-center transition-transform duration-300 ease-out ${
                    isActive(n) ? 'scale-x-100 bg-[#1DAA61]' : 'scale-x-0 group-hover:scale-x-100 bg-[#f59e0b]'
                  }`}
                />
              </button>
            ))}
          </nav>

          {/* desktop search */}
          {isLanding ? <div className="hidden lg:block flex-1" /> : <div className="relative flex-1 max-w-xs hidden lg:block">{searchBox(false)}</div>}

          {/* right actions */}
          <div className="flex items-center gap-2 ml-auto lg:ml-0 shrink-0">
            {isLanding && (
              <button
                onClick={() => go('dashboard')}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#e0f4e7] hover:bg-[#b3e4c4] text-[#2a6b43] font-bold text-xs cursor-pointer active:scale-95 transition-colors"
              >
                Browse Store
              </button>
            )}
            <button
              onClick={onOpenImageScanner}
              className={`${isLanding ? 'hidden' : 'hidden lg:flex'} items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#1daa61] to-[#3fc27b] hover:from-[#148a4c] hover:to-[#1daa61] text-white font-bold text-xs shadow-md shadow-[#1daa61]/20 hover:shadow-lg active:scale-95 transition-all cursor-pointer shrink-0`}
              title="Upload photo of your handwritten grocery list"
              aria-label="Upload grocery photo"
            >
              <Camera className="w-4 h-4" />
              <span className="xl:hidden">Upload</span>
              <span className="hidden xl:inline">Upload Grocery Photo</span>
            </button>

            <button
              onClick={onOpenVoice}
              className={`${isLanding ? 'hidden' : 'hidden lg:flex'} items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f3fbf6] hover:bg-[#e0f4e7] text-[#2a6b43] font-semibold text-xs transition-colors cursor-pointer border border-[#e0f4e7] active:scale-95`}
              title="Voice Ordering"
              aria-label="Voice ordering"
            >
              <Mic className="w-4 h-4 text-[#148a4c]" />
              <span>Voice</span>
            </button>

            <button
              type="button"
              onClick={onOpenFavorites}
              className="relative p-2 rounded-full bg-white border border-[#e0f4e7] text-rose-500 hover:bg-rose-50 transition-all cursor-pointer active:scale-95"
              aria-label="My favourites"
              title="My favourites"
              className="relative rounded-full border border-[#f0dfe3] p-2.5 text-rose-500 transition-all hover:bg-rose-50"
            >
              <Heart
                size={17}
                className={favoritesCount > 0 ? 'fill-rose-500' : ''}
              />

              {favoritesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-4 h-4 rounded-full flex items-center justify-center px-1 border border-white">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              ref={cartBtnRef}
              type="button"
              onClick={onOpenCart}
              className="cart-btn group relative h-10 pl-3 pr-3 sm:pr-4 rounded-full bg-gradient-to-br from-[#1DAA61] to-[#3fc27b] text-white flex items-center gap-2 font-bold text-[13px] ring-2 ring-white shadow-lg shadow-[#1DAA61]/30 hover:shadow-xl hover:shadow-[#1DAA61]/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer overflow-visible"
              aria-label={`View cart${cartCount ? `, ${cartCount} items` : ''}`}
            >
              <span key={cartHit} className={`db-cart-ico cart-ico ${cartHit ? 'hit' : ''} flex items-center justify-center w-6 h-6 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors`}>
                <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.3} />
              </span>
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span key={cartCount} className="cart-badge absolute -top-1.5 -right-1.5 bg-[#f59e0b] text-white font-black text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow">
                  {cartCount}
                </span>
              )}
            </button>

            {/* account circle */}
            {user ? (
              <div ref={accountRef} className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3fc27b] to-[#7fcf9a] text-white font-black text-[13px] flex items-center justify-center ring-2 ring-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  aria-label="My account"
                  aria-expanded={accountOpen}
                  title="My account"
                >
                  {initialsOf(user.name)}
                </button>

                {accountOpen && (
                  <div className="acc-pop absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1.5rem))] bg-white rounded-2xl shadow-2xl border border-[#e0f4e7] overflow-hidden z-50">
                    <style>{`@keyframes acc-pop{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}.acc-pop{animation:acc-pop .18s ease-out;transform-origin:top right}`}</style>
                    <div className="p-4 bg-gradient-to-br from-[#f3fbf6] to-[#e0f4e7] flex items-center gap-3">
                      <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3fc27b] to-[#7fcf9a] text-white font-black text-base flex items-center justify-center shrink-0">
                        {initialsOf(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-[#2a6b43] truncate">{user.name || 'My account'}</p>
                        <p className="text-[11px] text-[#4d7a5c]">Signed in</p>
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-2 text-xs text-[#2a6b43] border-b border-[#f3fbf6]">
                      {user.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#148a4c] shrink-0" /><span className="truncate">{user.phone}</span></p>}
                      {user.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#148a4c] shrink-0" /><span className="truncate">{user.email}</span></p>}
                      {user.address && <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-[#148a4c] shrink-0 mt-0.5" /><span className="break-words">{user.address}</span></p>}
                      {!user.phone && !user.email && !user.address && <p className="text-[#4d7a5c]">Your details are saved when you place an order.</p>}
                    </div>

                    <div className="p-2">
                      {onOpenOrders && (
                        <button onClick={() => { setAccountOpen(false); onOpenOrders(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#2a6b43] hover:bg-[#f3fbf6] cursor-pointer">
                          <ListOrdered className="w-4 h-4 text-[#148a4c]" /> My Orders
                        </button>
                      )}
                      <button onClick={() => { setAccountOpen(false); onOpenFavorites?.(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#2a6b43] hover:bg-[#f3fbf6] cursor-pointer">
                        <Heart className="w-4 h-4 text-rose-500" /> My Favourites
                      </button>
                      <button onClick={() => { setAccountOpen(false); onLogout(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer">
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-full bg-white border-2 border-[#b3e4c4] hover:border-[#3fc27b] text-[#2a6b43] text-xs font-bold transition-colors cursor-pointer active:scale-95"
                aria-label="Sign in"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
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

    {/* phones & tablets: the search bar takes the whole line (voice and camera sit inside it), the page links are below */}
    <div className="lg:hidden bg-white border-b border-[#e0f4e7] px-3 sm:px-6 pt-2.5 pb-2 space-y-1.5">
      {!isLanding && <div className="w-full">{searchBox(true)}</div>}
      <nav className="grid grid-cols-3 gap-1">
        {nav.map((n) => (
          <button
            key={n.key}
            onClick={() => goNav(n)}
            className={`group relative py-2.5 text-[12px] sm:text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
              isActive(n) ? 'text-[#1DAA61]' : 'text-[#4d7a5c] active:text-[#1DAA61]'
            }`}
          >
            {n.label}
            <span
              className={`pointer-events-none absolute left-2 right-2 bottom-0 h-[3px] rounded-full origin-center transition-transform duration-300 ${
                isActive(n) ? 'scale-x-100 bg-[#1DAA61]' : 'scale-x-0 group-active:scale-x-100 bg-[#f59e0b]'
              }`}
            />
          </button>
        ))}
      </nav>
    </div>
    </>
  );
};