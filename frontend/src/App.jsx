import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Providers Context
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';

// Route Guards
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminRoute from './components/common/AdminRoute';

// Layout Wrappers
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import NotificationToast from './components/notifications/NotificationToast';

// Student Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Tracker from './pages/Tracker';
import Bill from './pages/Bill';
import Profile from './pages/Profile';
import StudentOrders from './pages/Orders';
import NotificationCenter from './pages/NotificationCenter';

// Admin Pages
import AdminDashboard from './admin/Dashboard';
import AdminOrders from './admin/Orders';
import LiveTracking from './admin/LiveTracking';
import MenuManagement from './admin/MenuManagement';
import Categories from './admin/Categories';
import Coupons from './admin/Coupons';
import Payments from './admin/Payments';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <NotificationProvider>
            <div className="flex flex-col min-h-screen">
              <NotificationToast />
              <Navbar />
              <main className="flex-grow">
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/menu" element={<Menu />} />

                  {/* Student Protected routes */}
                  <Route path="/cart" element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  } />
                  <Route path="/tracker/:id" element={
                    <ProtectedRoute>
                      <Tracker />
                    </ProtectedRoute>
                  } />
                  <Route path="/bill/:id" element={
                    <ProtectedRoute>
                      <Bill />
                    </ProtectedRoute>
                  } />
                  <Route path="/orders" element={
                    <ProtectedRoute>
                      <StudentOrders />
                    </ProtectedRoute>
                  } />
                  <Route path="/notifications" element={
                    <ProtectedRoute>
                      <NotificationCenter />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />

                {/* Admin Protected routes */}
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } />
                <Route path="/admin/live-tracking" element={
                  <AdminRoute>
                    <LiveTracking />
                  </AdminRoute>
                } />
                <Route path="/admin/orders" element={
                  <AdminRoute>
                    <LiveTracking />
                  </AdminRoute>
                } />
                <Route path="/admin/menu" element={
                  <AdminRoute>
                    <MenuManagement />
                  </AdminRoute>
                } />
                <Route path="/admin/categories" element={
                  <AdminRoute>
                    <Categories />
                  </AdminRoute>
                } />
                <Route path="/admin/coupons" element={
                  <AdminRoute>
                    <Coupons />
                  </AdminRoute>
                } />
                <Route path="/admin/payments" element={
                  <AdminRoute>
                    <Payments />
                  </AdminRoute>
                } />

                {/* Fallback redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
              <Footer />
            </div>
          </NotificationProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
