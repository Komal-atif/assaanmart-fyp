import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CardShapes } from './components/CardShapes';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { StoreDashboard } from './components/StoreDashboard';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './components/AuthModal';
import { AnimatedBackground } from './components/AnimatedBackground';
import { GroceryImageScannerModal } from './components/GroceryImageScannerModal';
import { WelcomeAgent } from './components/WelcomeAgent';
import type { VoiceLaunch } from './components/VoiceAssistantModal';

import { categories as baseCategories, products as offlineProducts } from './data/groceryData';
import { fetchCatalog, buildCategories } from './services/catalogApi';
import { CartItem, Product, User, Order } from './types';
import { Check, X, ShoppingBag } from 'lucide-react';
import { supabase } from './supabaseClient';
import { MyOrdersModal } from './components/MyOrdersModal';
import { ListOrdered } from 'lucide-react';

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
  // Navigation View: 'landing' or 'dashboard'
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');

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
        name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email?.endsWith('@phone.assanmart.pk') ? 'Shopper' : u.email?.split('@')[0]) || 'Shopper',
        // phone accounts use a placeholder email behind the scenes: never show it
        email: u.email?.endsWith('@phone.assanmart.pk') ? '' : u.email || '',
        phone: u.user_metadata?.phone || (u.email?.endsWith('@phone.assanmart.pk') ? u.email.split('@')[0] : ''),
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

    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
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
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...product, quantity }];
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
            i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
          );
        } else {
          updated.push({ ...product, quantity });
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
            i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
          );
        } else {
          updated.push({ ...product, quantity });
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
          updated = updated.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i));
        } else {
          updated.push({ ...product, quantity });
        }
      });
      return updated;
    });
    setCartHit((h) => h + 1);
    showToast(`Added ${items.length} item${items.length === 1 ? '' : 's'} from your list`);
    setIsCartOpen(true);
  };

  const handleChangeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === productId ? { ...i, quantity: i.quantity + delta } : i))
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
      setCurrentView('landing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="dashboard-page min-h-screen text-[#064e3b] flex flex-col font-sans selection:bg-[#cde8dd] selection:text-[#064e3b] relative">
      
      {/* Dynamic Animated Living Gradient Mesh & Floating Orbs Background */}
      <AnimatedBackground />

      {/* SVG Clip Path definitions for video card animations */}
      <CardShapes />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#064e3b] text-white px-5 py-3 rounded-full shadow-2xl text-xs sm:text-sm font-semibold border border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0">
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
              <span className="w-8 h-8 rounded-full bg-[#064e3b] text-white flex items-center justify-center">
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
        cartBtnRef={cartBtnRef}
      />

      {/* Main View Router: Landing Page OR Dashboard */}
      <main className="flex-1 relative z-10">
        {currentView === 'landing' ? (
          <LandingPage
            onBrowseStore={() => {
              setCurrentView('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenVoice={() => { setVoiceLaunch(null); setIsVoiceOpen(true); }}
            onQuickSearch={(query) => {
              setSearchTerm(query);
              setCurrentView('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
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
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onChangeQuantity={handleChangeQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          if (!user) {
            // browsing and filling the cart is free; placing an order needs an account
            setCheckoutAfterLogin(true);
            setIsAuthOpen(true);
            showToast('Please sign in to place your order. Your cart is saved.');
            return;
          }
          setIsCheckoutOpen(true);
        }}
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
        onContinueByVoice={({ cart, lines }) => {
          setIsImageScannerOpen(false);
          setVoiceLaunch({ lang: voiceLang, preload: { lang: voiceLang, cart, lines } });
          setIsVoiceOpen(true);
        }}
      />

      {/* My Orders */}
      <MyOrdersModal isOpen={isOrdersOpen} onClose={() => setIsOrdersOpen(false)} user={user} />
      {user && !isOrdersOpen && (
        <button
          onClick={() => setIsOrdersOpen(true)}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-emerald-200 text-emerald-800 text-xs font-bold shadow-lg hover:bg-emerald-50 cursor-pointer"
        >
          <ListOrdered className="w-4 h-4" /> My Orders
        </button>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProductDetail}
        onClose={() => setSelectedProductDetail(null)}
        onAddToCart={handleAddMultiple}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        user={user}
        onOrderSuccess={(order: Order) => {
          setCart([]);
          showToast(`Order #${order.id} placed successfully!`);
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