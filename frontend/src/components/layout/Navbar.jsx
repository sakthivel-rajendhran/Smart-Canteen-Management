import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { 
  Home, 
  Utensils, 
  ShoppingCart, 
  ClipboardList, 
  User, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  BadgeIndianRupee,
  Receipt,
  Zap,
  CheckCircle2,
  Ticket,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  TicketPercent
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile drawer states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuControlOpen, setMobileMenuControlOpen] = useState(false);

  // Desktop dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuControlRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/admin/live-tracking') {
      return location.pathname === '/admin/live-tracking' || location.pathname === '/admin/orders';
    }
    return location.pathname === path;
  };

  // Whether current route belongs to Menu Control
  const isMenuControlActive = ['/admin/menu', '/admin/categories', '/admin/coupons'].includes(location.pathname);

  // Automatically close desktop dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  // Open mobile Menu Control accordion if current active route belongs to it
  useEffect(() => {
    if (mobileMenuOpen && isMenuControlActive) {
      setMobileMenuControlOpen(true);
    }
  }, [mobileMenuOpen, isMenuControlActive]);

  // Click outside listener for desktop dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuControlRef.current && !menuControlRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Desktop hover handlers with smooth delay
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 150);
  };

  const handleToggleDropdown = (e) => {
    e.preventDefault();
    setDropdownOpen((prev) => !prev);
  };

  // Customer bottom navigation items
  const studentNavItems = [
    { label: 'Home', path: '/', icon: <Home className="w-5 h-5" /> },
    { label: 'Menu', path: '/menu', icon: <Utensils className="w-5 h-5" /> },
    { label: 'Cart', path: '/cart', icon: (
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-amber text-primary-darker font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </div>
    ) },
    { label: 'Orders', path: '/orders', icon: <ClipboardList className="w-5 h-5" /> },
    { label: 'Pickup', path: '/pickup', icon: <Ticket className="w-5 h-5" /> },
    { label: 'Profile', path: '/profile', icon: <User className="w-5 h-5" /> }
  ];

  // Admin Navigation Items (before Menu Control)
  const adminPrimaryNavItems = [
    { label: 'Overview', path: '/admin', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { label: 'POS Billing', path: '/admin/pos', icon: <Zap className="w-3.5 h-3.5" /> },
    { label: 'Live Queue', path: '/admin/live-tracking', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { label: 'Handover', path: '/admin/handover', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { label: 'Bill Archive', path: '/admin/bills', icon: <Receipt className="w-3.5 h-3.5" /> },
  ];

  // Menu Control Dropdown Submenu Items
  const menuControlSubItems = [
    { label: 'Menu Management', path: '/admin/menu', icon: <Utensils className="w-4 h-4" /> },
    { label: 'Category Management', path: '/admin/categories', icon: <Layers className="w-4 h-4" /> },
    { label: 'Coupon Management', path: '/admin/coupons', icon: <TicketPercent className="w-4 h-4" /> },
  ];

  // Admin Navigation Items (after Menu Control)
  const adminSecondaryNavItems = [
    { label: 'Payments', path: '/admin/payments', icon: <BadgeIndianRupee className="w-3.5 h-3.5" /> },
  ];

  const renderNavLinks = () => {
    if (user?.role === 'admin') {
      const getAdminItemClass = (active) =>
        `h-9 min-w-[88px] xl:min-w-[96px] px-2.5 xl:px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all select-none whitespace-nowrap text-center ${
          active
            ? 'bg-amber text-primary-darker font-black shadow-sm shadow-amber/20'
            : 'text-white/85 hover:bg-white/10 hover:text-white bg-transparent'
        }`;

      return (
        <>
          {adminPrimaryNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={getAdminItemClass(isActive(item.path))}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          {/* ================= MENU CONTROL DROPDOWN (DESKTOP) ================= */}
          <div
            ref={menuControlRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              onClick={handleToggleDropdown}
              className={`h-9 min-w-[108px] xl:min-w-[116px] px-2.5 xl:px-3 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer whitespace-nowrap text-center ${
                isMenuControlActive
                  ? 'bg-amber text-primary-darker font-black shadow-sm shadow-amber/20'
                  : 'text-white/85 hover:bg-white/10 hover:text-white bg-transparent'
              }`}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Menu Control</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Container */}
            <div
              className={`absolute top-full left-0 pt-2 z-50 transition-all duration-200 transform origin-top-left ${
                dropdownOpen
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="bg-[#072419] border border-amber/30 rounded-2xl shadow-xl shadow-black/60 p-1.5 min-w-[210px] backdrop-blur-md">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber/80 border-b border-white/10 mb-1">
                  Catalog Control
                </div>
                {menuControlSubItems.map((subItem) => {
                  const isSubActive = location.pathname === subItem.path;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={() => setDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                        isSubActive
                          ? 'bg-amber text-primary-darker font-black shadow-xs'
                          : 'text-white/85 hover:bg-white/10 hover:text-white font-medium'
                      }`}
                    >
                      <span className={isSubActive ? 'text-primary-darker' : 'text-amber'}>
                        {subItem.icon}
                      </span>
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {adminSecondaryNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={getAdminItemClass(isActive(item.path))}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          <NotificationBell isAdmin={true} />

          <button
            onClick={handleLogout}
            className="h-9 min-w-[80px] xl:min-w-[88px] px-2.5 xl:px-3 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 text-white/75 hover:bg-red-500/20 hover:text-red-300 transition-all select-none whitespace-nowrap text-center"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </>
      );
    }

    return (
      <>
        <Link
          to="/menu"
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            isActive('/menu')
              ? 'text-white bg-white/15'
              : 'text-white/85 hover:bg-white/10 hover:text-white'
          }`}
        >
          Menu
        </Link>
        {user ? (
          <>
            <Link
              to="/orders"
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                isActive('/orders')
                  ? 'text-white bg-white/15'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              Track Orders
            </Link>
            <Link
              to="/pickup"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                isActive('/pickup')
                  ? 'text-white bg-white/15'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Ticket className="w-4 h-4 text-amber" />
              <span>Pickup</span>
            </Link>
            <Link
              to="/profile"
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                isActive('/profile')
                  ? 'text-white bg-white/15'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              Profile
            </Link>
            <div className="mx-1">
              <NotificationBell />
            </div>
            <Link
              to="/cart"
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold bg-amber text-primary-darker hover:bg-amber-dark transition-all shadow-md ml-2`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart ({cartCount})</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-red-400 text-xs font-medium ml-4"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="px-5 py-2 rounded-full text-sm font-bold bg-amber text-primary-darker hover:bg-amber-dark transition-all shadow-md ml-2"
          >
            Login / Sign Up
          </Link>
        )}
      </>
    );
  };

  return (
    <>
      {/* Desktop/Tablet Header */}
      <nav className="bg-primary-darker border-b border-white/10 sticky top-0 z-50 px-[5%] h-16 flex items-center justify-between shadow-lg">
        <Link to="/" className="flex items-center gap-2 text-decoration-none">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center font-bold text-lg shadow-md shadow-amber/30">
            🍛
          </div>
          <span className="font-outfit text-xl text-white font-extrabold tracking-tight">
            DRS <em className="text-amber not-italic">Quick Serve</em>
          </span>
        </Link>

        {/* Desktop Links (Hidden on mobile) */}
        <div className={`hidden ${user?.role === 'admin' ? 'lg:flex' : 'md:flex'} items-center gap-1 xl:gap-1.5`}>
          {renderNavLinks()}
        </div>

        {/* Mobile Header Menu Button (Hidden on desktop) */}
        <div className={`${user?.role === 'admin' ? 'lg:hidden' : 'md:hidden'} flex items-center gap-3`}>
          {user && (
            <NotificationBell isAdmin={user.role === 'admin'} />
          )}
          {user?.role === 'admin' || user?.role === 'ADMIN' ? (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-amber transition-all focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          ) : user ? (
            // Authenticated customer mobile layout: show cart icon on header
            <Link to="/cart" className="relative text-white p-1 hover:text-amber transition-colors" title="View Cart">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber text-primary-darker font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </Link>
          ) : (
            // Visitor on landing page: replace cart icon with professional Login / Sign Up button
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber text-primary-darker hover:bg-amber-dark active:scale-95 transition-all shadow-md shadow-amber/25"
            >
              <User className="w-3.5 h-3.5" />
              <span>Login / Sign Up</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Admin Mobile Menu Drawer */}
      {mobileMenuOpen && (user?.role === 'admin' || user?.role === 'ADMIN') && (
        <div className="lg:hidden fixed inset-0 z-40 bg-primary-darker/95 backdrop-blur-md pt-20 px-6 flex flex-col gap-2.5 overflow-y-auto pb-10">
          {adminPrimaryNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-bold transition-all ${
                isActive(item.path)
                  ? 'bg-amber text-primary-darker'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Menu Control Mobile Accordion */}
          <div className="rounded-xl overflow-hidden border border-white/15 bg-white/5">
            <button
              type="button"
              onClick={() => setMobileMenuControlOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-sm font-bold transition-all ${
                isMenuControlActive
                  ? 'bg-amber text-primary-darker'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <SlidersHorizontal className="w-5 h-5" />
                <span>Menu Control</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  mobileMenuControlOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {mobileMenuControlOpen && (
              <div className="pl-6 pr-3 py-2 flex flex-col gap-1.5 bg-black/25 border-t border-white/10">
                {menuControlSubItems.map((subItem) => {
                  const isSubActive = location.pathname === subItem.path;
                  return (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      onClick={() => {
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold transition-all ${
                        isSubActive
                          ? 'bg-amber text-primary-darker font-black'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className={isSubActive ? 'text-primary-darker' : 'text-amber'}>
                        {subItem.icon}
                      </span>
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {adminSecondaryNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-bold transition-all ${
                isActive(item.path)
                  ? 'bg-amber text-primary-darker'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 p-3.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-950/20 mt-4"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout Dashboard</span>
          </button>
        </div>
      )}

      {/* Customer Mobile Bottom Navigation: Visible ONLY when authenticated (Hidden on public landing page & admin) */}
      {Boolean(user && user.role !== 'admin' && user.role !== 'ADMIN') && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#072419] border-t-2 border-amber/40 z-50 min-h-[68px] pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-1.5 px-1 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] flex items-center justify-around select-none">
          {studentNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all ${
                  active
                    ? 'text-amber font-black bg-white/10 shadow-xs scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                <div className={`${active ? 'text-amber drop-shadow-[0_1px_4px_rgba(245,158,11,0.5)]' : 'text-white/80'}`}>
                  {item.icon}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight ${active ? 'font-black text-amber' : 'font-medium text-white/80'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Navbar;
