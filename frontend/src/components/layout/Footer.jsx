import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Footer = () => {
  const { user } = useAuth();
  
  // Hide footer on mobile bottom-nav layout to preserve screen space
  return (
    <footer className="bg-primary-darker py-8 px-[5%] text-center text-white/50 border-t border-white/5 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="font-outfit text-lg text-white font-extrabold mb-2">
          DRS <em className="text-amber not-italic">Quick Serve</em>
        </div>
        <p className="text-xs mb-4">
          © {new Date().getFullYear()} DRS — College Canteen Management System | Authentic Tamil Food 🍛
        </p>
        <div className="flex justify-center gap-6 text-xs font-semibold text-amber/80">
          <Link to="/menu" className="hover:underline">Menu</Link>
          <span className="text-white/20">•</span>
          <Link to="/orders" className="hover:underline">Track Order</Link>
          <span className="text-white/20">•</span>
          {user?.role === 'admin' ? (
            <Link to="/admin" className="hover:underline">Admin Dashboard</Link>
          ) : (
            <Link to="/login" className="hover:underline">Canteen Admin</Link>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
