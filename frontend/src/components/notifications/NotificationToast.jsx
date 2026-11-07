import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ExternalLink } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';

const NotificationToast = () => {
  const { toasts, dismissToast } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || window.location.pathname.startsWith('/admin');

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isHigh = toast.priority === 'HIGH';

        const handleAction = () => {
          dismissToast(toast.id);
          // For admin: do not redirect to tracker
          if (!isAdmin && toast.orderCode) {
            navigate(`/tracker/${toast.orderCode}`);
          }
        };

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto bg-primary-darker/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border transition-all duration-300 transform animate-in slide-in-from-top-4 fade-in ${
              isHigh
                ? 'border-amber ring-2 ring-amber/30'
                : 'border-white/15'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0 shadow-inner">
                {toast.icon || '🔔'}
              </div>

              {/* Text info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <h4 className="font-outfit font-black text-sm tracking-tight text-white leading-tight">
                    {toast.title}
                  </h4>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="text-white/40 hover:text-white transition-colors p-1 -mr-1 -mt-1"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-white/80 mt-1 leading-snug">
                  {toast.message}
                </p>

                {/* View Order Action button */}
                {toast.orderCode && (
                  <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                    <button
                      onClick={handleAction}
                      className="inline-flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-primary-darker font-outfit font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      <span>View Order #{toast.orderCode}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToast;
