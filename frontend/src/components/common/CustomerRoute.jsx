import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * CustomerRoute Guard:
 * - Grants access exclusively to authenticated student and staff customers.
 * - Redirects unauthenticated visitors to /login.
 * - Strictly prevents Admin users from viewing customer-only interfaces (such as My Food Pickups),
 *   redirecting them directly to the Admin Handover counter (/admin/handover).
 */
const CustomerRoute = ({ children, redirectTo = '/admin/handover' }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Strictly restrict authenticated Admins from accessing the customer pickup interface
  if (isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default CustomerRoute;
