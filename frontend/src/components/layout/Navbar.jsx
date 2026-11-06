import React, { useState } from 'react';
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
  FolderEdit, 
  Percent, 
  BadgeIndianRupee 
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Student bottom navigation items
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
    { label: 'Profile', path: '/profile', icon: <User className="w-5 h-5" /> }
  ];

  // Admin navigation items
  const adminNavItems = [
    { label: 'Overview', path: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Live Tracking', path: '/admin/live-tracking', icon: <ClipboardList className="w-4 h-4" /> },
    { label: 'Manage Menu', path: '/admin/menu', icon: <Utensils className="w-4 h-4" /> },
    { label: 'Categories', path: '/admin/categories', icon: <FolderEdit className="w-4 h-4" /> },
    { label: 'Coupons', path: '/admin/coupons', icon: <Percent className="w-4 h-4" /> },
    { label: 'Payments', path: '/admin/payments', icon: <BadgeIndianRupee className="w-4 h-4" /> }
  ];

  const renderNavLinks = () => {
    if (user?.role === 'admin') {
      return (
        <>
          {adminNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                isActive(item.path)
                  ? 'bg-amber text-primary-darker shadow-md'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="ml-2">
            <NotificationBell isAdmin={true} />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white/50 hover:bg-red-950/20 hover:text-red-400 transition-all ml-2"
          >
            <LogOut className="w-4 h-4" />
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
      {/* Desktop/Tablet Header Header */}
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
        <div className="hidden md:flex items-center gap-2">
          {renderNavLinks()}
        </div>

        {/* Mobile Header Menu Button (Hidden on desktop) */}
        <div className="md:hidden flex items-center gap-3">
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
        <div className="md:hidden fixed inset-0 z-40 bg-primary-darker/95 backdrop-blur-md pt-20 px-6 flex flex-col gap-4">
          {adminNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-4 p-4 rounded-xl text-sm font-bold transition-all ${
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
            className="flex items-center gap-4 p-4 rounded-xl text-sm font-bold text-red-400 hover:bg-red-950/20 mt-auto mb-10"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout Dashboard</span>
          </button>
        </div>
      )}

      {/* Customer Mobile Bottom Navigation: Visible ONLY when authenticated (Hidden on public landing page & admin) */}
      {Boolean(user && user.role !== 'admin' && user.role !== 'ADMIN') && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-primary-darker/98 backdrop-blur-md border-t border-white/10 z-40 h-16 pb-[env(safe-area-inset-bottom,0px)] px-2 shadow-2xl flex items-center justify-around">
          {studentNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                isActive(item.path)
                  ? 'text-amber scale-105 font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default Navbar;
