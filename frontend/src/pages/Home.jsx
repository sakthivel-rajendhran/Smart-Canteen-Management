import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import MenuCacheService from '../services/menuCache';
import { 
  ArrowRight, 
  Smartphone, 
  MapPin, 
  Leaf, 
  Ticket, 
  CreditCard, 
  Bell, 
  Sparkles,
  Clock,
  CheckCircle,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Home = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [emojis, setEmojis] = useState([]);
  const [featuredItems, setFeaturedItems] = useState([]);

  useEffect(() => {
    const list = ['🍛', '🍲', '🥤', '☕', '🍩', '⚪️', '🫓', '🥥', '🍹', '🌿', '🍱', '🥗'];
    const temp = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      char: list[i % list.length],
      left: Math.random() * 100 + '%',
      delay: Math.random() * 10 + 's',
      duration: (10 + Math.random() * 15) + 's',
      size: (20 + Math.random() * 24) + 'px',
    }));
    setEmojis(temp);

    // Fetch featured foods with client cache
    const fetchFeatured = async () => {
      try {
        const cached = MenuCacheService.getFeatured();
        if (cached && cached.length > 0) {
          setFeaturedItems(cached.slice(0, 4));
          if (MenuCacheService.isFeaturedFresh()) return;
        }

        const res = await API.get('/menu?featuredOnly=true');
        if (res.data?.success) {
          setFeaturedItems(res.data.data.slice(0, 4));
          MenuCacheService.setFeatured(res.data.data);
        }
      } catch (e) {
        // Silent catch for home preview
      }
    };
    fetchFeatured();
  }, []);

  const features = [
    { icon: <Smartphone className="w-6 h-6 text-primary" />, title: "Order from Anywhere", desc: "Order from your phone or laptop — no queue, no waiting at the counter." },
    { icon: <MapPin className="w-6 h-6 text-primary" />, title: "Live Order Tracking", desc: "Watch your order status update in real time — from Placed to Ready for Pickup." },
    { icon: <Leaf className="w-6 h-6 text-primary" />, title: "100% Traditional", desc: "Authentic Tamil Nadu recipes — Pongal, Sambar, Dosa and more, made fresh daily." },
    { icon: <Ticket className="w-6 h-6 text-primary" />, title: "Coupon Discounts", desc: "Use codes DRS10, DRS20, or WELCOME to save on every order placed online." },
    { icon: <CreditCard className="w-6 h-6 text-primary" />, title: "Online or Cash", desc: "Pay securely online via Razorpay or choose Cash on Pickup." },
    { icon: <Bell className="w-6 h-6 text-primary" />, title: "Instant Notifications", desc: "Get notified the moment your order status changes — no more guessing." },
  ];

  return (
    <div className="relative overflow-hidden bg-cream min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] bg-gradient-to-br from-primary-darker via-primary-dark to-[#1a5c38] flex items-center py-16 px-[5%] overflow-hidden">
        
        {/* Floating food emojis backdrops */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {emojis.map((em) => (
            <span
              key={em.id}
              className="absolute text-white/5 animate-[floatUp_linear_infinite]"
              style={{
                left: em.left,
                animationDelay: em.delay,
                animationDuration: em.duration,
                fontSize: em.size,
                bottom: '-50px',
              }}
            >
              {em.char}
            </span>
          ))}
        </div>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber/15 border border-amber/35 px-4.5 py-1.5 rounded-full text-amber font-bold text-xs uppercase tracking-wider mb-6">
              <span className="w-2 h-2 bg-amber rounded-full animate-ping"></span>
              DRS College Canteen
            </div>
            <h1 className="font-outfit font-black text-5xl md:text-6xl text-white leading-tight mb-5 tracking-tight">
              Fresh Food.<br />
              <span className="text-amber">Smart Ordering.</span><br />
              Zero Waiting.
            </h1>
            <p className="text-white/70 text-base md:text-lg max-w-md leading-relaxed mb-8">
              Skip the queue — order your favourite Tamil meals, snacks & fresh juices from your phone in seconds. Real-time tracking included.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                to={user ? "/menu" : "/login"} 
                className="bg-amber text-primary-darker font-bold px-8 py-3.5 rounded-full hover:bg-amber-dark transition-all transform hover:-translate-y-0.5 shadow-lg shadow-amber/30 flex items-center gap-2"
              >
                Order Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                to="/menu" 
                className="bg-transparent border-2 border-white/30 text-white font-bold px-8 py-3.5 rounded-full hover:bg-white/10 hover:border-white transition-all transform hover:-translate-y-0.5"
              >
                View Menu
              </Link>
            </div>
          </div>

          {/* Right Cards Showcase: Real Food Photography Cards */}
          <div className="grid grid-cols-2 gap-4">
            {featuredItems.length > 0 ? (
              featuredItems.map((item) => {
                const img = item.image?.url || (typeof item.image === 'string' ? item.image : '') || '';
                return (
                  <Link
                    key={item._id}
                    to="/menu"
                    className="group bg-white/10 border border-white/20 rounded-2xl overflow-hidden backdrop-blur-md hover:bg-white/15 hover:-translate-y-1 transition-all flex flex-col text-left shadow-lg"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/20">
                      {img ? (
                        <img
                          src={img}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          {item.emoji}
                        </div>
                      )}
                      <span className="absolute top-2 right-2 bg-amber text-primary-darker font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                        ₹{item.price}
                      </span>
                    </div>
                    <div className="p-3">
                      <h4 className="font-outfit font-bold text-white text-xs md:text-sm line-clamp-1 group-hover:text-amber transition-colors">
                        {item.name}
                      </h4>
                      <span className="text-white/60 text-[10px] block mt-0.5">
                        {item.category?.name || 'Fresh Prep'} • {item.preparationTime || 10}m
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              [
                { emoji: '🍛', title: 'Full Meals', sub: 'Saapadu & Rice' },
                { emoji: '⚪️', title: 'Idli & Dosa', sub: 'Fresh & Hot' },
                { emoji: '🍩', title: 'Snacks', sub: 'Vadai & Bonda' },
                { emoji: '🥤', title: 'Juices', sub: 'Nannari & More' }
              ].map((c, i) => (
                <div 
                  key={i} 
                  className="bg-white/5 border border-white/15 rounded-2xl p-6 text-center backdrop-blur-md hover:bg-white/10 hover:-translate-y-1 transition-all"
                >
                  <span className="text-5xl block mb-3 drop-shadow-md">{c.emoji}</span>
                  <h4 className="font-outfit font-bold text-white text-base mb-1">{c.title}</h4>
                  <p className="text-white/55 text-xs">{c.sub}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-amber py-5 px-[5%]">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-around items-center gap-6">
          {[
            { num: "500+", label: "Orders Placed" },
            { num: "21", label: "Menu Items" },
            { num: "5 min", label: "Avg Prep Time" },
            { num: "100%", label: "Traditional" }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="font-outfit font-black text-3xl text-primary-dark">{stat.num}</div>
              <div className="text-[10px] uppercase font-bold text-primary-dark/60 tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 27: Featured Foods Showcase */}
      {featuredItems.length > 0 && (
        <section className="py-20 px-[5%] max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-amber/15 border border-amber/35 text-primary-darker px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber fill-amber" /> Chef's Daily Specials
              </span>
              <h2 className="font-outfit text-3xl md:text-4xl text-primary-dark font-black tracking-tight">
                Featured Canteen Specialties
              </h2>
            </div>
            <Link
              to="/menu"
              className="text-primary hover:text-primary-dark font-bold text-sm flex items-center gap-1 group self-start md:self-auto"
            >
              <span>Explore Complete Menu</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredItems.map((item) => {
              const img = item.image?.url || (typeof item.image === 'string' ? item.image : '') || '';
              return (
                <div
                  key={item._id}
                  className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                >
                  <div className="relative aspect-[4/3] bg-cream overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">
                        {item.emoji}
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-amber text-primary-darker font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-primary-darker" /> Featured
                    </span>
                    <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber" /> {item.preparationTime || 10}m
                    </span>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-outfit font-black text-base text-primary-dark mb-1">
                      {item.name}
                    </h3>
                    <p className="text-muted text-xs leading-relaxed line-clamp-2 mb-4 flex-1">
                      {item.description || 'Authentic traditional recipe prepared fresh at DRS Canteen.'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60 mt-auto">
                      <span className="font-outfit font-black text-xl text-primary-dark">
                        ₹{item.price}
                      </span>
                      <button
                        onClick={() => addToCart(item, 1)}
                        className="bg-primary-dark hover:bg-primary text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 px-[5%] max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block bg-amber/10 border border-amber/30 text-amber px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            Why Choose DRS
          </span>
          <h2 className="font-outfit text-3xl md:text-4xl text-primary-dark font-black tracking-tight mb-4">
            Made for Fast Food Lovers
          </h2>
          <p className="text-muted max-w-md mx-auto text-sm leading-relaxed">
            Everything you need to get your favourite canteen food without the wait.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feat, i) => (
            <div 
              key={i} 
              className="bg-white border border-border p-8 rounded-3xl hover:-translate-y-1.5 hover:shadow-xl hover:border-primary/25 transition-all group"
            >
              <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all">
                {React.cloneElement(feat.icon, { className: "w-6 h-6 group-hover:text-white transition-all" })}
              </div>
              <h3 className="font-outfit font-bold text-primary-dark text-lg mb-3">{feat.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-primary-darker py-20 px-[5%] text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-amber/15 border border-amber/30 text-amber px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              Simple Process
            </span>
            <h2 className="font-outfit text-3xl md:text-4xl text-white font-black tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-white/60 max-w-md mx-auto text-sm leading-relaxed">
              Four easy steps to get your favourite Tamil food delivered to your hands.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { num: "1", title: "Login / Sign Up", desc: "Create a free account or login from any device in seconds." },
              { num: "2", title: "Browse & Add", desc: "Pick your favourite Tamil meals, snacks and juices." },
              { num: "3", title: "Pay & Confirm", desc: "Apply coupon code, pay online or cash, and confirm order." },
              { num: "4", title: "Track & Collect", desc: "Watch live status and collect when it's ready at the counter." }
            ].map((step, i) => (
              <div key={i} className="text-center relative group">
                <div className="w-14 h-14 bg-amber text-primary-darker font-outfit font-black text-2xl rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber/25">
                  {step.num}
                </div>
                <h3 className="font-outfit font-bold text-base mb-2">{step.title}</h3>
                <p className="text-white/50 text-xs leading-relaxed max-w-[200px] mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Float animation CSS */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.08;
          }
          90% {
            opacity: 0.08;
          }
          100% {
            transform: translateY(-110vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
