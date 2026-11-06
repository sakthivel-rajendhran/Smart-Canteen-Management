import React, { useState, useEffect } from 'react';
import { Download, X, WifiOff, Share, PlusSquare } from 'lucide-react';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    // 1. Detect online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsIosDevice(isIos && !isStandalone);

    // 3. Listen for Android / Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check if user previously dismissed today
      const dismissedUntil = localStorage.getItem('drs_pwa_dismissed_until');
      if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Handle post-install event
    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIosDevice) {
        setShowIosModal(true);
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Dismiss for 24 hours
    localStorage.setItem('drs_pwa_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  return (
    <>
      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div
          role="alert"
          className="fixed top-16 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-between text-xs sm:text-sm font-semibold animate-pulse"
        >
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>
              You are currently offline. You can browse cached menu items, but placing new orders requires an active connection.
            </span>
          </div>
        </div>
      )}

      {/* PWA Install Banner (Android / Desktop Chrome) */}
      {showInstallBanner && (
        <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-40 bg-[#0b3d2e] text-white p-4 rounded-2xl shadow-2xl border border-emerald-700/60 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0 text-xl">
              🍛
            </div>
            <div>
              <h4 className="text-sm font-bold text-cream">Install DRS Quick Serve</h4>
              <p className="text-xs text-emerald-200/80">Install app for fast 1-tap ordering & offline access</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#faf8f4] text-stone-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🍛</span>
                <div>
                  <h3 className="text-base font-bold text-[#0b3d2e]">Install on iPhone / iPad</h3>
                  <p className="text-xs text-stone-500">Add to your home screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs sm:text-sm text-stone-700 font-medium my-4">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#0b3d2e] flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                <span>Tap the <Share className="w-4 h-4 inline mx-1 text-blue-600" /> <strong>Share</strong> button in Safari toolbar</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#0b3d2e] flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                <span>Scroll down and tap <PlusSquare className="w-4 h-4 inline mx-1 text-stone-800" /> <strong>Add to Home Screen</strong></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#0b3d2e] flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full mt-2 py-2.5 bg-[#0b3d2e] text-white rounded-xl text-xs font-bold hover:bg-[#1a7a45] transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
