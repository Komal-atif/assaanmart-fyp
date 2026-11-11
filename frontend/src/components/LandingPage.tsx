
import React from 'react';
import {
  ArrowRight,
  Mic,
  Camera,
  ShoppingBasket,
  Leaf,
  Truck,
  ShieldCheck,
  Sparkles,
  Store,
  MessageCircle,
  Heart,
  Gift,
  Clock,
  Star,
  ShoppingBag,
  Flower2,
} from 'lucide-react';

interface LandingPageProps {
  onBrowseStore: () => void;
  onOpenVoice: () => void;
  onQuickSearch: (query: string) => void;
  onOpenImageScanner?: () => void;
}

const images = {
  hero: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85',
  fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=85',
  vegetables: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=700&q=85',
  beverages: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=700&q=85',
  snacks: 'https://images.unsplash.com/photo-1621939514649-280e2aa2f3a0?auto=format&fit=crop&w=700&q=85',
  personalCare: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=700&q=85',
  grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85',
  strawberries: 'https://images.unsplash.com/photo- strawberries',
  apples: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=85',
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=85',
  biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=85',
  oranges: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=85',
};

const SafeImage = ({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className={`relative overflow-hidden bg-[#eaf1e5] ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-700"
        />
      ) : (
        <div className="flex h-full min-h-[120px] items-center justify-center bg-gradient-to-br from-[#e7efdf] to-[#f7f5eb]">
          <div className="text-center text-[#78936d]">
            <ShoppingBasket size={35} className="mx-auto" />
            <p className="mt-2 text-xs">{alt}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({
  onBrowseStore,
  onOpenVoice,
  onQuickSearch,
  onOpenImageScanner,
}) => {
  const categories = [
    { name: 'Fruits', image: images.fruits, query: 'Fruits' },
    { name: 'Vegetables', image: images.vegetables, query: 'Vegetables' },
    { name: 'Beverages', image: images.beverages, query: 'Beverages' },
    { name: 'Snacks & Biscuits', image: images.snacks, query: 'Snacks' },
    { name: 'Personal Care', image: images.personalCare, query: 'Personal Care' },
  ];

  const promotions = [
    {
      tag: 'FRESH COLLECTION',
      title: 'A Little Freshness in Every Bite',
      description: 'Explore fruits and vegetables for your everyday meals.',
      image: images.fruits,
      query: 'Fruits',
      bg: 'bg-[#edf4e8]',
    },
    {
      tag: 'SNACK TIME',
      title: 'Make Every Break Delicious',
      description: 'Discover biscuits and snacks for your cravings.',
      image: images.snacks,
      query: 'Snacks',
      bg: 'bg-[#f6eee4]',
    },
    {
      tag: 'DAILY ESSENTIALS',
      title: 'Your Everyday Must-Haves',
      description: 'Find the essentials you need, all in one place.',
      image: images.personalCare,
      query: 'Personal Care',
      bg: 'bg-[#f0edf5]',
    },
  ];

  const featuredProducts = [
    {
      name: 'Fresh Apples',
      category: 'Fruits',
      image: images.apples,
      label: 'FRESH PICK',
      query: 'Fruits',
    },
    {
      name: 'Milk & Dairy',
      category: 'Beverages',
      image: images.milk,
      label: 'DAILY ESSENTIAL',
      query: 'Beverages',
    },
    {
      name: 'Crunchy Biscuits',
      category: 'Snacks & Biscuits',
      image: images.biscuits,
      label: 'SNACK TIME',
      query: 'Snacks',
    },
    {
      name: 'Fresh Oranges',
      category: 'Fruits',
      image: images.oranges,
      label: 'CUSTOMER PICK',
      query: 'Fruits',
    },
  ];

  const services = [
    {
      icon: <Store size={25} />,
      title: 'Easy Grocery Shopping',
      description: 'Browse categories and find your everyday grocery essentials.',
    },
    {
      icon: <Mic size={25} />,
      title: 'AI Voice Ordering',
      description: 'Speak naturally to tell AssaanMart what you want to order.',
    },
    {
      icon: <Camera size={25} />,
      title: 'Image Search',
      description: 'Use a picture to make finding your desired products easier.',
    },
    {
      icon: <Truck size={25} />,
      title: 'Convenient Experience',
      description: 'Keep your selected grocery items organized in one place.',
    },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="overflow-hidden bg-[#fbfcf8] text-[#294d35]">

      {/* TOP PROMO STRIP */}
      <div className="bg-[#294d35] px-4 py-2.5 text-center text-xs font-medium tracking-wide text-white sm:text-sm">
        <span className="inline-flex items-center justify-center gap-2">
          <Sparkles size={15} className="text-[#d5e8c9]" />
          Discover fresh picks and everyday grocery essentials with AssaanMart
          <Sparkles size={15} className="text-[#d5e8c9]" />
        </span>
      </div>

      {/* HERO */}
      <section id="home" className="relative bg-[#eff5e9]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:px-12 lg:py-24">

          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8e5d0] bg-white px-4 py-2 text-sm text-[#63845d] shadow-sm">
              <Sparkles size={16} />
              A smarter way to shop
            </div>

            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Your Daily Groceries,
              <span className="mt-2 block text-[#71966b]">
                Made Easier.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-[#748474]">
              Shop your everyday essentials in one place. Browse products,
              speak your grocery order, or discover items using images with
              AssaanMart.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onBrowseStore}
                className="flex items-center justify-center gap-3 rounded-full bg-[#527c55] px-7 py-4 font-semibold text-white transition duration-300 hover:-translate-y-1 hover:bg-[#3d6543] hover:shadow-xl"
              >
                Start Shopping <ArrowRight size={18} />
              </button>

              <button
                onClick={onOpenVoice}
                className="flex items-center justify-center gap-3 rounded-full border border-[#cbdcc4] bg-white px-7 py-4 font-semibold text-[#527c55] transition duration-300 hover:-translate-y-1 hover:bg-[#f8fbf5] hover:shadow-lg"
              >
                <Mic size={18} /> Try Voice Ordering
              </button>
            </div>

            <div className="mt-9 flex flex-wrap gap-5 text-sm text-[#718171]">
              <span className="flex items-center gap-2">
                <ShieldCheck size={17} /> Simple Shopping
              </span>
              <span className="flex items-center gap-2">
                <Mic size={17} /> Voice Enabled
              </span>
              <span className="flex items-center gap-2">
                <Leaf size={17} /> Everyday Essentials
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-8 -top-8 h-56 w-56 rounded-full bg-[#dcebd3] blur-3xl" />

            <div className="relative grid grid-cols-5 gap-3">
              <div className="col-span-3 h-[320px] overflow-hidden rounded-[30px] shadow-xl sm:h-[400px]">
                <SafeImage src={images.hero} alt="Fresh groceries" className="h-full" />
              </div>

              <div className="col-span-2 grid gap-3">
                <div className="h-[153px] overflow-hidden rounded-[25px] sm:h-[193px]">
                  <SafeImage src={images.fruits} alt="Fresh fruits" className="h-full" />
                </div>
                <div className="h-[153px] overflow-hidden rounded-[25px] sm:h-[193px]">
                  <SafeImage src={images.vegetables} alt="Fresh vegetables" className="h-full" />
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 left-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl sm:-left-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf2e5] text-[#63845d]">
                <Mic size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold">Just speak & shop</p>
                <p className="mt-1 text-xs text-gray-500">Your voice, your order</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="border-b border-[#edf0e7] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4 sm:px-8 lg:px-12">
          {[
            { icon: <ShoppingBasket />, title: 'Easy Shopping', desc: 'Browse with ease' },
            { icon: <Mic />, title: 'Voice Assistance', desc: 'Order by speaking' },
            { icon: <Camera />, title: 'Image Search', desc: 'Search with pictures' },
            { icon: <ShieldCheck />, title: 'User Friendly', desc: 'Simple experience' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf4e8] text-[#63845d]">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SPECIAL OFFERS */}
      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">

          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
                Something special for you
              </p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Fresh Deals & Highlights
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#819080]">
                Explore handpicked collections for your everyday needs.
              </p>
            </div>
            <button
              onClick={onBrowseStore}
              className="flex items-center gap-2 text-sm font-semibold text-[#63845d] transition hover:gap-3"
            >
              Explore Store <ArrowRight size={17} />
            </button>
          </div>

          {/* MAIN PROMO BANNER */}
          <div className="group relative overflow-hidden rounded-[30px] bg-[#dcebd5] shadow-sm">
            <div className="absolute inset-0">
              <SafeImage
                src={images.hero}
                alt="Fresh grocery collection"
                className="h-full w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1f3d2a]/90 via-[#294d35]/65 to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-[340px] items-center px-7 py-12 sm:min-h-[390px] sm:px-12 lg:px-16">
              <div className="max-w-xl text-white">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold tracking-wider backdrop-blur-sm">
                  <Gift size={15} />
                  ASSAANMART SPECIAL
                </div>

                <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
                  Freshness You'll
                  <span className="block text-[#d6edc9]">Love Every Day.</span>
                </h2>

                <p className="mt-5 max-w-md text-sm leading-7 text-white/85 sm:text-base">
                  From fresh produce to daily essentials, discover everything
                  you need for a happier shopping experience.
                </p>

                <button
                  onClick={onBrowseStore}
                  className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-bold text-[#365d3d] shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-[#eaf2e5]"
                >
                  Explore Collections <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="absolute -right-8 -top-8 hidden h-36 w-36 rounded-full border-[20px] border-white/10 lg:block" />
          </div>

          {/* PROMOTION CARDS */}
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo) => (
              <button
                key={promo.title}
                onClick={() => onQuickSearch(promo.query)}
                className={`group relative flex min-h-[245px] overflow-hidden rounded-[25px] text-left ${promo.bg}`}
              >
                <div className="relative z-10 flex w-[57%] flex-col justify-center p-5 sm:p-6">
                  <span className="text-[10px] font-bold tracking-[2px] text-[#71966b]">
                    {promo.tag}
                  </span>
                  <h3 className="mt-3 text-lg font-bold leading-snug text-[#294d35] sm:text-xl">
                    {promo.title}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-[#718171]">
                    {promo.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#527c55]">
                    Explore Now <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                  </span>
                </div>
                <div className="absolute right-0 top-0 h-full w-[48%] overflow-hidden">
                  <SafeImage
                    src={promo.image}
                    alt={promo.title}
                    className="h-full transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TRENDING PRODUCTS */}
      <section className="bg-[#f4f7ef] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
                Popular choices
              </p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Trending This Week
              </h2>
              <p className="mt-3 text-sm text-[#819080]">
                Take a look at some of our featured grocery picks.
              </p>
            </div>
            <button
              onClick={onBrowseStore}
              className="flex items-center gap-2 text-sm font-semibold text-[#63845d] hover:gap-3"
            >
              View All <ArrowRight size={17} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <button
                key={product.name}
                onClick={() => onQuickSearch(product.query)}
                className="group overflow-hidden rounded-[22px] border border-[#e8eee2] bg-white text-left shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-[#527c55]/10"
              >
                <div className="relative h-40 overflow-hidden bg-[#edf3e9] sm:h-56">
                  <SafeImage
                    src={product.image}
                    alt={product.name}
                    className="h-full transition duration-700 group-hover:scale-110"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-bold tracking-wider text-[#63845d] shadow-sm">
                    {product.label}
                  </span>
                  <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#527c55] shadow-md transition group-hover:bg-[#527c55] group-hover:text-white">
                    <ArrowRight size={17} />
                  </span>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#91a58a]">
                    {product.category}
                  </p>
                  <h3 className="mt-2 text-sm font-bold text-[#294d35] sm:text-base">
                    {product.name}
                  </h3>
                  <p className="mt-2 text-xs text-[#819080]">
                    Explore collection
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
                Explore our store
              </p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                Shop by Category
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#819080]">
                Discover your everyday essentials in our grocery collection.
              </p>
            </div>
            <button
              onClick={onBrowseStore}
              className="flex items-center gap-2 text-sm font-semibold text-[#63845d]"
            >
              View all products <ArrowRight size={17} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => onQuickSearch(category.query)}
                className="group text-left"
              >
                <div className="h-44 overflow-hidden rounded-3xl bg-[#eaf1e5] shadow-sm sm:h-52">
                  <SafeImage
                    src={category.image}
                    alt={category.name}
                    className="h-full transition duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-1 pt-4">
                  <h3 className="text-sm font-semibold sm:text-base">{category.name}</h3>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf2e5] text-[#63845d] transition group-hover:bg-[#527c55] group-hover:text-white">
                    <ArrowRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="bg-[#eff5e9] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="h-[330px] overflow-hidden rounded-[30px] shadow-lg sm:h-[420px]">
            <SafeImage src={images.hero} alt="AssaanMart grocery shopping" className="h-full" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
              About AssaanMart
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Grocery Shopping,
              <span className="block text-[#71966b]">With a Smarter Touch.</span>
            </h2>
            <p className="mt-5 text-sm leading-8 text-[#718171] sm:text-base">
              AssaanMart combines traditional grocery shopping with AI-powered
              assistance. Customers can browse products manually or use voice
              interaction to communicate their grocery needs.
            </p>

            <div className="mt-7 space-y-4">
              {[
                'Browse products through organized categories.',
                'Communicate your grocery needs using voice.',
                'Find products through image-based search.',
                'Manage selected products in your shopping cart.',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm text-[#607560]">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#789b70]" />
                  {point}
                </div>
              ))}
            </div>

            <button
              onClick={onBrowseStore}
              className="mt-8 flex items-center gap-3 rounded-full bg-[#527c55] px-7 py-4 text-sm font-semibold text-white transition hover:-translate-y-1 hover:bg-[#3d6543]"
            >
              Explore Store <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-white px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
              What we offer
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Everything You Need, In One Place.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#819080]">
              Useful features that make everyday grocery shopping easier.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => (
              <div
                key={service.title}
                className="rounded-3xl border border-[#e9eee5] bg-[#fbfcf8] p-7 transition duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-[#527c55]/10"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf2e5] text-[#63845d]">
                  {service.icon}
                </div>
                <p className="mt-5 text-xs font-semibold text-[#a0b398]">
                  0{index + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#819080]">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VOICE ORDERING */}
      <section className="bg-[#294d35] px-5 py-20 text-white sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[3px] text-[#c5dbb9]">
              Smart voice experience
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
              Just Say It.
              <span className="block text-[#c5dbb9]">We'll Help You Shop.</span>
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-8 text-[#d0dfcc] sm:text-base">
              Tell AssaanMart what groceries you need. Our AI-powered voice
              experience helps you communicate naturally and makes grocery
              ordering more convenient.
            </p>
            <button
              onClick={onOpenVoice}
              className="mt-8 flex items-center gap-3 rounded-full bg-[#dcebd5] px-7 py-4 text-sm font-bold text-[#294d35] transition hover:-translate-y-1 hover:bg-white"
            >
              <Mic size={19} /> Try Voice Ordering
            </button>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[.08] p-6 sm:p-9">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#dcebd5] text-[#294d35]">
                <MessageCircle size={23} />
              </div>
              <div>
                <p className="font-semibold">AssaanMart Assistant</p>
                <p className="mt-1 text-xs text-[#c5dbb9]">Example conversation</p>
              </div>
            </div>

            <div className="my-9 space-y-5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#dcebd5] p-4 text-sm leading-6 text-[#294d35]">
                I need apples, milk and some biscuits.
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white/10 p-4 text-sm leading-6 text-white">
                Sure! I can help you find those items. Let's add them to your
                grocery list.
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dcebd5] text-[#294d35]">
                <Mic size={21} />
              </div>
              <div>
                <p className="text-sm font-semibold">Voice interaction</p>
                <p className="mt-1 text-xs text-[#c5dbb9]">Speak naturally</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IMAGE SEARCH */}
      <section className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[30px] bg-[#eff5e9] p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[3px] text-[#82a177]">
              Smart image search
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Find Products
              <span className="block text-[#71966b]">With an Image.</span>
            </h2>
            <p className="mt-5 text-sm leading-8 text-[#718171]">
              Have a picture of the product you want? Use image search to make
              finding your desired grocery items easier.
            </p>
            {onOpenImageScanner && (
              <button
                onClick={onOpenImageScanner}
                className="mt-8 flex items-center gap-3 rounded-full bg-[#527c55] px-7 py-4 text-sm font-semibold text-white transition hover:-translate-y-1 hover:bg-[#3d6543]"
              >
                <Camera size={18} /> Try Image Search
              </button>
            )}
          </div>

          <div className="h-[280px] overflow-hidden rounded-[25px] shadow-lg sm:h-[350px]">
            <SafeImage src={images.vegetables} alt="Fresh grocery products" className="h-full" />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#e7efdf] px-6 py-14 text-center sm:px-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#63845d] shadow-sm">
            <ShoppingBasket size={27} />
          </div>
          <h2 className="mt-6 text-3xl font-bold sm:text-4xl">
            Ready to Make Shopping Easier?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#718171]">
            Explore your grocery essentials and experience a smarter way to
            shop with AssaanMart.
          </p>
          <button
            onClick={onBrowseStore}
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#527c55] px-8 py-4 text-sm font-semibold text-white transition duration-300 hover:-translate-y-1 hover:bg-[#3d6543] hover:shadow-lg"
          >
            Start Shopping <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#294d35] px-5 py-12 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-b border-white/10 pb-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dcebd5] text-[#294d35]">
                  <ShoppingBasket size={23} />
                </div>
                <span className="text-2xl font-bold">
                  Assaan<span className="text-[#c5dbb9]">Mart</span>
                </span>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#c4d4c0]">
                Everyday groceries, made easier with smart shopping and
                AI-powered assistance.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">Quick Links</h3>
              <div className="mt-5 flex flex-col gap-3 text-sm text-[#c4d4c0]">
                <button onClick={() => scrollTo('home')} className="w-fit hover:text-white">Home</button>
                <button onClick={() => scrollTo('about')} className="w-fit hover:text-white">About Us</button>
                <button onClick={() => scrollTo('services')} className="w-fit hover:text-white">Services</button>
                <button onClick={() => scrollTo('categories')} className="w-fit hover:text-white">Categories</button>
                <button onClick={() => scrollTo('contact')} className="w-fit hover:text-white">Contact</button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold">Explore</h3>
              <div className="mt-5 flex flex-col gap-3 text-sm text-[#c4d4c0]">
                <button onClick={onBrowseStore} className="w-fit hover:text-white">Browse Store</button>
                <button onClick={onOpenVoice} className="w-fit hover:text-white">Voice Ordering</button>
                {onOpenImageScanner && (
                  <button onClick={onOpenImageScanner} className="w-fit hover:text-white">Image Search</button>
                )}
              </div>
            </div>
          </div>

          <div id="contact" className="flex flex-col justify-between gap-3 pt-6 text-xs text-[#b4c8b0] sm:flex-row">
            <p>© {new Date().getFullYear()} AssaanMart. All rights reserved.</p>
            <p>Smarter grocery shopping, made simple.</p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
