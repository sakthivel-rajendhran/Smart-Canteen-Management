import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Providers Context
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';

// Route Guards
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminRoute from './components/common/AdminRoute';

// Layout Wrappers
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import NotificationToast from './components/notifications/NotificationToast';
import PWAInstaller from './components/common/PWAInstaller';

// Core Student Pages (eager loaded for fast first render)
import Home from './pages/Home';
import Login from './pages/Login';
import Menu from './pages/Menu';

// Lazy-loaded Student Pages
const Cart = lazy(() => import('./pages/Cart'));
const Tracker = lazy(() => import('./pages/Tracker'));
const Bill = lazy(() => import('./pages/Bill'));
const Profile = lazy(() => import('./pages/Profile'));
const StudentOrders = lazy(() => import('./pages/Orders'));
const Pickup = lazy(() => import('./pages/Pickup'));
const PickupDisplay = lazy(() => import('./pages/PickupDisplay'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));

// Lazy-loaded Admin Pages (includes heavy libraries like Recharts)
const AdminDashboard = lazy(() => import('./admin/Dashboard'));
const AdminOrders = lazy(() => import('./admin/Orders'));
const LiveTracking = lazy(() => import('./admin/LiveTracking'));
const POSBilling = lazy(() => import('./admin/POSBilling'));
const FoodHandover = lazy(() => import('./admin/FoodHandover'));
const BillHistory = lazy(() => import('./admin/BillHistory'));
const MenuManagement = lazy(() => import('./admin/MenuManagement'));
const Categories = lazy(() => import('./admin/Categories'));
const Coupons = lazy(() => import('./admin/Coupons'));
const Payments = lazy(() => import('./admin/Payments'));

const PageFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center">
    <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mb-3" />
    <span className="text-muted text-xs font-bold uppercase tracking-wider">Loading...</span>
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <NotificationProvider>
              <div className="flex flex-col min-h-screen">
                <NotificationToast />
                <PWAInstaller />
                <Navbar />
                <main className="flex-grow pb-20 md:pb-0">
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/menu" element={<Menu />} />
                      <Route path="/pickup-display" element={<PickupDisplay />} />

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
                      <Route path="/pickup" element={
                        <ProtectedRoute>
                          <Pickup />
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
                      <Route path="/admin/pos" element={
                        <AdminRoute>
                          <POSBilling />
                        </AdminRoute>
                      } />
                      <Route path="/admin/handover" element={
                        <AdminRoute>
                          <FoodHandover />
                        </AdminRoute>
                      } />
                      <Route path="/admin/bills" element={
                        <AdminRoute>
                          <BillHistory />
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
                  </Suspense>
                </main>
                <Footer />
              </div>
            </NotificationProvider>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
