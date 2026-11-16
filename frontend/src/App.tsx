import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CardShapes } from './components/CardShapes';
import { Header } from './components/Header';
import type { AppView } from './components/Header';
import { ServicesPage } from './components/ServicesPage';
import { ContactPage } from './components/ContactPage';
import { StoreDashboard } from './components/StoreDashboard';
import { LandingPage } from './components/LandingPage';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './components/AuthModal';
import { AnimatedBackground } from './components/AnimatedBackground';
import { GroceryImageScannerModal } from './components/GroceryImageScannerModal';
import { FavoritesModal } from './components/FavoritesModal';
import { WelcomeAgent } from './components/WelcomeAgent';
import type { VoiceLaunch } from './components/VoiceAssistantModal';

import { categories as baseCategories, products as offlineProducts } from './data/groceryData';
import { fetchCatalog, buildCategories } from './services/catalogApi';
import { CartItem, Product, User, Order } from './types';
import { Check, X, ShoppingBag } from 'lucide-react';
import { supabase } from './supabaseClient';
import { MyOrdersModal } from './components/MyOrdersModal';
import { clampQty, maxFor, LIMIT_MSG } from './utils/limits';

interface FlyingItem {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  image?: string;
  icon?: string;
  size: number;
}

export default function App() {
  // Navigation View: the store opens first; Services and Contact Us are separate pages
  const [currentView, setCurrentView] = useState<AppView>('landing');

  // Products come from the backend (what the admin added / changed). The old Excel data is used ONLY if the backend cannot be reached.
  const [productList, setProductList] = useState<Product[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list = await fetchCatalog();
        if (alive) { setProductList(list); }
      } catch {
        if (alive) { setProductList((prev) => (prev.length ? prev : offlineProducts)); }
      }
    };
    load();
    const timer = setInterval(load, 30000);                    // admin changes show up within 30 s
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);
  const categories = useMemo(() => buildCategories(productList, baseCategories), [productList]);

  // User Authentication
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('am_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Keep the Supabase login in step with the page: restore it after a refresh, clear it after sign-out.
  useEffect(() => {
    const toUser = (u: any): User =>
      ({
        name: u.user_metadata?.full_name || u.user_metadata?.name || (/^\d{11}@/.test(u.email || '') ? 'Shopper' : u.email?.split('@')[0]) || 'Shopper',
        // phone accounts use a placeholder email behind the scenes: never show it
        email: /^\d{11}@/.test(u.email || '') ? '' : u.email || '',
        phone: u.user_metadata?.phone || (/^\d{11}@/.test(u.email || '') ? u.email.split('@')[0] : ''),
        address: u.user_metadata?.address || '',
      } as User);
    const apply = (session: any) => {
      if (session?.user) {
        setUser((prev) => {
          const next = { ...(prev || {}), ...toUser(session.user) } as User;
          try { localStorage.setItem('am_user', JSON.stringify(next)); } catch {}
          return next;
        });
      } else {
        try { localStorage.removeItem('am_user'); } catch {}
        setUser(null);
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('am_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active Category & Search
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // favourites (the hearts): kept in this browser, shown in the header and on top of the products
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('am_favorites') || '[]'); } catch { return []; }
  });
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const toggleFavorite = (p: Product) =>
    setFavorites((prev) => {
      const next = prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id];
      try { localStorage.setItem('am_favorites', JSON.stringify(next)); } catch { /* private window: still works for this visit */ }
      return next;
    });

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceLaunch, setVoiceLaunch] = useState<VoiceLaunch | null>(null);
  const [afterOrderSignal, setAfterOrderSignal] = useState(0);
  const [voiceLang, setVoiceLang] = useState<'english' | 'urdu'>('english');
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isImageScannerOpen, setIsImageScannerOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutAfterLogin, setCheckoutAfterLogin] = useState(false); // a guest pressed checkout: sign in first, then continue
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // Flying animations & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [cartHit, setCartHit] = useState(0);

  // Replay the header logo intro when the page changes or any modal/drawer closes.
  const [logoPlayKey, setLogoPlayKey] = useState(0);
  const anyModalOpen =
    isFavoritesOpen || isCartOpen || isVoiceOpen || isOrdersOpen || isImageScannerOpen ||
    isAuthOpen || isCheckoutOpen || !!selectedProductDetail;
  const wasModalOpen = useRef(false);
  useEffect(() => {
    if (wasModalOpen.current && !anyModalOpen) setLogoPlayKey((k) => k + 1);
    wasModalOpen.current = anyModalOpen;
  }, [anyModalOpen]);
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    setLogoPlayKey((k) => k + 1);
  }, [currentView]);
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);
  const toastTimerRef = useRef<any>(null);

  // Sync cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('am_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // Cart item map for instant O(1) quantity lookups
  const cartMap = useMemo(() => {
    return Object.fromEntries(cart.map((i) => [i.id, i.quantity]));
  }, [cart]);

  // Video-accurate Flying Arc Animation to Cart
  const triggerFlyAnimation = (element: HTMLElement, product: Product) => {
    const toRect = cartBtnRef.current?.getBoundingClientRect();
    const cardEl = element.closest('.db-gcard');
    const picEl = cardEl?.querySelector('.db-gimg img, .db-gimg .db-emoji');
    const fromRect = (picEl || element).getBoundingClientRect();

    if (!fromRect || !toRect) return;

    const size = Math.max(38, Math.min(fromRect.width, fromRect.height, 90));
    const cx = fromRect.left + fromRect.width / 2;
    const cy = fromRect.top + fromRect.height / 2;
    const key = `${Date.now()}-${Math.random()}`;

    setFlyingItems((prev) => [
      ...prev,
      {
        id: key,
        x: cx - size / 2,
        y: cy - size / 2,
        dx: toRect.left + toRect.width / 2 - cx,
        dy: toRect.top + toRect.height / 2 - cy,
        image: product.image,
        icon: product.icon,
        size,
      },
    ]);

    setTimeout(() => setCartHit((h) => h + 1), 620);
    setTimeout(() => setFlyingItems((prev) => prev.filter((item) => item.id !== key)), 780);
  };

  // Add to cart with animation
  const handleAddToCart = (product: Product, element?: HTMLElement) => {
    if (product.stock === 0) {
      showToast('This item is currently out of stock.');
      return;
    }
    if (product.price == null) {
      showToast('Price unavailable for this product.');
      return;
    }

    const inCart = cart.find((i) => i.id === product.id)?.quantity ?? 0;
    if (inCart >= maxFor(product)) {
      showToast(LIMIT_MSG);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: clampQty(i, i.quantity + 1) } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    if (element) {
      triggerFlyAnimation(element, product);
    }
    showToast(`${product.name} added to cart`);
  };

  const handleAddMultiple = (product: Product, quantity: number) => {
    if (product.stock === 0 || product.price == null) return;
    const have = cart.find((i) => i.id === product.id)?.quantity ?? 0;
    if (have >= maxFor(product)) {
      showToast(LIMIT_MSG);
      return;
    }
    const room = maxFor(product) - have;
    if (quantity > room) {
      quantity = room;
      showToast(LIMIT_MSG);
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: clampQty(i, i.quantity + quantity) } : i));
      }
      return [...prev, { ...product, quantity: clampQty(product, quantity) }];
    });
    showToast(`Added ${quantity}x ${product.name} to cart`);
  };

  const handleAddBatchFromVoice = (items: { product: Product; quantity: number }[]) => {
    setCart((prev) => {
      let updated = [...prev];
      items.forEach(({ product, quantity }) => {
        const existing = updated.find((i) => i.id === product.id);
        if (existing) {
          updated = updated.map((i) =>
            i.id === product.id ? { ...i, quantity: clampQty(i, i.quantity + quantity) } : i
          );
        } else {
          updated.push({ ...product, quantity: clampQty(product, quantity) });
        }
      });
      return updated;
    });
    setCartHit((h) => h + 1);
    showToast(`Voice Assistant added ${items.length} items to your basket!`);
  };

  const handleSyncVoiceCart = (
    prevIds: string[],
    items: { product: Product; quantity: number }[]
  ) => {
    setCart((prev) => {
      const prevSet = new Set(prevIds);
      // remove what the voice session added earlier, then put in the agent's current basket
      let updated = prev.filter((i) => !prevSet.has(i.id));
      items.forEach(({ product, quantity }) => {
        if (product.price == null) return;
        const existing = updated.find((i) => i.id === product.id);
        if (existing) {
          updated = updated.map((i) =>
            i.id === product.id ? { ...i, quantity: clampQty(i, i.quantity + quantity) } : i
          );
        } else {
          updated.push({ ...product, quantity: clampQty(product, quantity) });
        }
      });
      return updated;
    });
    setCartHit((h) => h + 1);
  };

  // Items the customer reviewed after scanning a photo of their list: add them and show the cart so they can order.
  const handleAddScanned = (items: { product: Product; quantity: number }[]) => {
    setCart((prev) => {
      let updated = [...prev];
      items.forEach(({ product, quantity }) => {
        if (product.stock === 0 || product.price == null) return;
        const existing = updated.find((i) => i.id === product.id);
        if (existing) {
          updated = updated.map((i) => (i.id === product.id ? { ...i, quantity: clampQty(i, i.quantity + quantity) } : i));
        } else {
          updated.push({ ...product, quantity: clampQty(product, quantity) });
        }
      });
      return updated;
    });
    setCartHit((h) => h + 1);
    showToast(`Added ${items.length} item${items.length === 1 ? '' : 's'} from your list`);
  };

  // the cart drawer's checkout button, and the scanner's "checkout" (button or voice), do the same thing
  const proceedToCheckout = () => {
    setIsCartOpen(false);
    if (!user) {
      // browsing and filling the cart is free; placing an order needs an account
      setCheckoutAfterLogin(true);
      setIsAuthOpen(true);
      showToast('Please sign in to place your order. Your cart is saved.');
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleChangeQuantity = (productId: string, delta: number) => {
    const cur = cart.find((i) => i.id === productId);
    if (cur && delta > 0 && cur.quantity >= maxFor(cur)) {
      showToast(LIMIT_MSG);
      return;
    }
    setCart((prev) =>
      prev
        .map((i) => (i.id === productId ? { ...i, quantity: clampQty(i, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const navigateSection = (sectionId: string) => {
    if (sectionId === 'home') {
      setCurrentView('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const scrollToIt = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // "How it works" lives on the landing page
    if (sectionId === 'how-it-works') {
      if (currentView !== 'landing') {
        setCurrentView('landing');
        window.setTimeout(scrollToIt, 200);
      } else scrollToIt();
      return;
    }
    // sections live on the store home: leave other pages / search / category first, then scroll once it has drawn
    if (currentView !== 'dashboard' || !document.getElementById(sectionId)) {
      setCurrentView('dashboard');
      setSearchTerm('');
      window.dispatchEvent(new Event('assanmart:show-home'));
      window.setTimeout(scrollToIt, 200);
      return;
    }
    scrollToIt();
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="dashboard-page min-h-screen text-[#2a6b43] flex flex-col font-sans selection:bg-[#b3e4c4] selection:text-[#2a6b43] relative">
      
      {/* Dynamic Animated Living Gradient Mesh & Floating Orbs Background */}
      <AnimatedBackground />

      {/* SVG Clip Path definitions for video card animations */}
      <CardShapes />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#1daa61] text-white px-5 py-3 rounded-full shadow-2xl text-xs sm:text-sm font-semibold border border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#7fcf9a] text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-300 hover:text-white ml-2 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Video-accurate Flying Photo Elements */}
      {flyingItems.map((f) => (
        <span
          key={f.id}
          className="db-gfly"
          style={
            {
              left: `${f.x}px`,
              top: `${f.y}px`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              '--dx': `${f.dx}px`,
              '--dy': `${f.dy}px`,
            } as React.CSSProperties
          }
        >
          <div className="db-gfly-inner">
            {f.image ? (
              <img src={f.image} alt="" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[#1daa61] text-white flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </span>
            )}
          </div>
        </span>
      ))}

      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigateView={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        user={user}
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenVoice={() => { setVoiceLaunch(null); setIsVoiceOpen(true); }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onLogout={async () => {
          await supabase.auth.signOut();
          localStorage.removeItem('am_user');
          setUser(null);
          showToast('Logged out successfully.');
        }}
        onOpenImageScanner={() => setIsImageScannerOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={(term) => {
          setSearchTerm(term);
          if (term.trim() && currentView !== 'dashboard') {
            setCurrentView('dashboard');
          }
        }}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateSection={navigateSection}
        products={productList}
        onSelectProduct={(p) => setSelectedProductDetail(p)}
        cartHit={cartHit}
        favoritesCount={favorites.length}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        cartBtnRef={cartBtnRef}
        logoPlayKey={logoPlayKey}
      />

      {/* Main View Router: Landing Page OR Dashboard */}
      <main className="flex-1 relative z-10">
        {currentView === 'landing' ? (
          <LandingPage
            onBrowseStore={() => { setCurrentView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onOpenVoice={() => { setVoiceLaunch(null); setIsVoiceOpen(true); }}
            onOpenImageScanner={() => setIsImageScannerOpen(true)}
            onQuickSearch={(q) => { setSearchTerm(q); setCurrentView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        ) : currentView === 'services' ? (
          <ServicesPage
            onOpenVoice={() => { setVoiceLaunch(null); setIsVoiceOpen(true); }}
            onOpenImageScanner={() => setIsImageScannerOpen(true)}
            onBrowseStore={() => { setCurrentView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onContact={() => { setCurrentView('contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        ) : currentView === 'contact' ? (
          <ContactPage user={user} />
        ) : (
          <StoreDashboard
            categories={categories}
            products={productList}
            cart={cartMap}
            onAddToCart={handleAddToCart}
            onChangeQuantity={handleChangeQuantity}
            onQuickView={(p) => setSelectedProductDetail(p)}
            initialCategory={selectedCategory}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onOpenImageScanner={() => setIsImageScannerOpen(true)}
            onOpenVoice={() => { setVoiceLaunch(null); setIsVoiceOpen(true); }}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        categories={categories}
        onSelectCategory={(catName) => {
          setSelectedCategory(catName);
          setCurrentView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateSection={navigateSection}
        onNavigateView={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Favourites (opens from the header heart, like the cart) */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        products={favorites.map((id) => productList.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))}
        cart={cartMap}
        onAddToCart={handleAddToCart}
        onChangeQuantity={handleChangeQuantity}
        onToggleFavorite={toggleFavorite}
        onQuickView={(p) => {
          setIsFavoritesOpen(false);
          setSelectedProductDetail(p);
        }}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onChangeQuantity={handleChangeQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={proceedToCheckout}
      />

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        products={productList}
        onSyncVoiceCart={handleSyncVoiceCart}
        launch={voiceLaunch}
        onNeedLogin={() => {
          // the agent told a guest to sign in: close the voice window, sign in, then continue to checkout with the same basket
          setIsVoiceOpen(false);
          setCheckoutAfterLogin(true);
          setIsAuthOpen(true);
        }}
        onOrderPlaced={() => {
          setIsVoiceOpen(false);
          setAfterOrderSignal((n) => n + 1);
        }}
      />

      {/* Welcome agent: greets by voice when the page opens, asks language, then voice or browse */}
      <WelcomeAgent
        voiceOpen={isVoiceOpen || isAuthOpen || isImageScannerOpen}
        afterOrderSignal={afterOrderSignal}
        onLanguage={setVoiceLang}
        onVoice={(lang) => {
          setVoiceLang(lang);
          setVoiceLaunch({ lang });
          setIsVoiceOpen(true);
        }}
      />

      {/* Grocery Image Scanner Modal (Extract groceries from photo & confirm by voice) */}
      <GroceryImageScannerModal
        isOpen={isImageScannerOpen}
        onClose={() => setIsImageScannerOpen(false)}
        products={productList}
        lang={voiceLang}
        onAddScanned={handleAddScanned}
        onCheckout={proceedToCheckout}
        onContinueByVoice={({ cart, lines }) => {
          setIsImageScannerOpen(false);
          setVoiceLaunch({ lang: voiceLang, preload: { lang: voiceLang, cart, lines } });
          setIsVoiceOpen(true);
        }}
      />

      {/* My Orders */}
      <MyOrdersModal isOpen={isOrdersOpen} onClose={() => setIsOrdersOpen(false)} user={user} />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProductDetail}
        onClose={() => setSelectedProductDetail(null)}
        onAddToCart={handleAddMultiple}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        lang={voiceLang}
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        user={user}
        onOrderSuccess={(order: Order) => {
          setCart([]);
          showToast(`Order ${order.id} placed successfully!`);
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        lang={voiceLang}
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setCheckoutAfterLogin(false);
        }}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          showToast(`Welcome back, ${loggedInUser.name}!`);
          if (checkoutAfterLogin && cart.length > 0) {
            setCheckoutAfterLogin(false);
            setIsCheckoutOpen(true);
          }
        }}
      />

    </div>
  );
}