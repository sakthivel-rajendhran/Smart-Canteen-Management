import React, { useState, useEffect, useRef, useMemo } from 'react';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  Clock,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  ShoppingBag,
  Bell,
  ArrowRight,
} from 'lucide-react';

const PickupDisplay = () => {
  const [readyTokens, setReadyTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [prevTokensCount, setPrevTokensCount] = useState(0);

  const { socket, isConnected } = useSocket();
  const audioCtxRef = useRef(null);

  // Live Digital Clock (ticks every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial list of ready tokens
  useEffect(() => {
    fetchPublicReadyTokens(true);

    // Fallback polling every 12 seconds to ensure 100% synchronization even across network drops
    const interval = setInterval(() => {
      fetchPublicReadyTokens(false);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    if (!socket) return;

    const handleTokensChanged = (eventData) => {
      console.log('📢 Pickup display received real-time event:', eventData);
      fetchPublicReadyTokens(false);
    };

    // Listen to dedicated broadcast event
    socket.on('pickup:readyTokensChanged', handleTokensChanged);
    // Also listen to general status events as fallback
    socket.on('order:statusChanged', handleTokensChanged);
    socket.on('order:updated', handleTokensChanged);

    return () => {
      socket.off('pickup:readyTokensChanged', handleTokensChanged);
      socket.off('order:statusChanged', handleTokensChanged);
      socket.off('order:updated', handleTokensChanged);
    };
  }, [socket]);

  // Audio Chime (Synthesized pleasant restaurant chime using Web Audio API)
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // Dual-tone chime: High E6 (1318.5 Hz) followed by G#6 (1661.2 Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15); // E6

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1567.98, now + 0.15); // G6

      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.5);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.9);
    } catch (e) {
      // Audio not permitted or supported
    }
  };

  const fetchPublicReadyTokens = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await API.get('/orders/public/ready-tokens');
      if (res.data?.success) {
        const newTokens = res.data.data || [];
        
        // Play chime if new tokens were added
        if (newTokens.length > prevTokensCount && prevTokensCount > 0) {
          playChime();
        }
        setPrevTokensCount(newTokens.length);
        setReadyTokens(newTokens);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('Could not refresh public ready tokens:', err?.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  // Format date and time for counter TV
  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-[#072419] text-white flex flex-col justify-between selection:bg-amber selection:text-stone-900 font-inter select-none">
      
      {/* ================= HEADER BAR ================= */}
      <header className="bg-[#0b3d2e] border-b border-white/10 px-6 py-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        
        {/* Branding & Subtitle */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber text-[#072419] font-black text-3xl flex items-center justify-center shadow-lg shadow-amber/20 border-2 border-amber/50">
            🍛
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-outfit text-2xl sm:text-3xl font-black tracking-tight text-white">
                DRS <span className="text-amber">QUICK SERVE</span>
              </span>
              <span className="bg-amber/20 border border-amber/40 text-amber text-xs font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Counter Display
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white/70 font-medium">
              DRS College Canteen • Live Food Collection Screen
            </p>
          </div>
        </div>

        {/* Live Clock & Connection Pill */}
        <div className="flex items-center gap-4">
          
          {/* Digital Clock */}
          <div className="bg-[#072419]/80 border border-white/10 px-5 py-2 rounded-2xl text-right shadow-inner">
            <div className="text-xl sm:text-2xl font-black font-mono text-amber tracking-wider leading-none">
              {formattedTime}
            </div>
            <div className="text-[11px] text-white/60 font-semibold mt-1">
              {formattedDate}
            </div>
          </div>

          {/* Action buttons (Fullscreen, Mute, Refresh) */}
          <div className="flex items-center gap-2">
            
            {/* Live Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                isConnected
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-400 animate-pulse'
              }`}
              title={isConnected ? 'Live real-time counter connected' : 'Reconnecting to counter...'}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">OFFLINE</span>
                </>
              )}
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition active:scale-95"
              title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchPublicReadyTokens(true)}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition active:scale-95"
              title="Manual Sync"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber' : ''}`} />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-amber hover:bg-amber-dark text-[#072419] font-black transition active:scale-95 shadow-md"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (TV Mode)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

        </div>

      </header>

      {/* ================= MAIN DISPLAY BODY ================= */}
      <main className="flex-1 px-4 sm:px-8 py-6 flex flex-col">
        
        {/* Banner Section */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-amber animate-ping" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber">
                Order Pickup Status
              </span>
            </div>
            <h1 className="font-outfit font-black text-3xl sm:text-5xl text-white tracking-tight flex items-center gap-3">
              READY FOR PICKUP
            </h1>
            <p className="text-white/70 text-xs sm:text-base mt-1">
              Please proceed to the collection counter when your token is displayed below.
            </p>
          </div>

          {/* Counter Badge */}
          <div className="flex items-center gap-3 bg-[#0b3d2e] border-2 border-amber/40 px-5 py-3 rounded-2xl shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              Orders Ready:
            </span>
            <span className="font-outfit font-black text-3xl text-amber">
              {readyTokens.length}
            </span>
          </div>
        </div>

        {/* Tokens Grid Area */}
        <div className="flex-1 flex flex-col justify-center">
          {loading && readyTokens.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 border-4 border-amber/20 border-t-amber rounded-full animate-spin mx-auto mb-4" />
              <p className="font-outfit font-bold text-lg text-white/80 uppercase tracking-widest">
                Connecting to Canteen Counter...
              </p>
            </div>
          ) : readyTokens.length === 0 ? (
            /* Empty State */
            <div className="max-w-2xl mx-auto py-16 px-8 text-center bg-white/5 border-2 border-dashed border-white/15 rounded-3xl backdrop-blur-xs">
              <div className="w-20 h-20 rounded-full bg-amber/10 border-2 border-amber/30 text-amber flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg">
                ✓
              </div>
              <h2 className="font-outfit font-black text-2xl sm:text-3xl text-white mb-2">
                All Orders Collected!
              </h2>
              <p className="text-white/70 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                No orders are currently waiting at the pickup counter. When the kitchen marks new orders as <strong>Ready</strong>, they will instantly appear here with a notification chime.
              </p>
            </div>
          ) : (
            /* Tokens Cards Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 auto-rows-fr">
              {readyTokens.map((tokenObj, idx) => {
                const token = tokenObj.pickupToken || tokenObj.orderCode;
                const isWalkIn = tokenObj.orderType === 'WALK_IN';
                
                // Calculate ready duration
                const readyDate = new Date(tokenObj.readyAt || Date.now());
                const timeDiffMins = Math.max(0, Math.round((currentTime - readyDate) / 60000));
                const readyTimeStr = readyDate.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <div
                    key={tokenObj.orderCode || idx}
                    className="group relative bg-gradient-to-b from-[#0b3d2e] to-[#072419] rounded-3xl p-5 sm:p-6 border-2 border-amber/60 hover:border-amber shadow-2xl hover:shadow-amber/20 transition-all duration-200 flex flex-col justify-between items-center text-center overflow-hidden animate-in fade-in zoom-in-95"
                  >
                    {/* Glowing Accent Top Bar */}
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300 shadow-sm" />

                    {/* Channel Tag */}
                    <div className="w-full flex items-center justify-between text-[10px] font-black tracking-wider uppercase mb-3">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          isWalkIn
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}
                      >
                        {isWalkIn ? 'Counter' : 'Online'}
                      </span>
                      <span className="text-white/50 font-mono font-medium">
                        {timeDiffMins > 0 ? `${timeDiffMins}m ago` : 'Just now'}
                      </span>
                    </div>

                    {/* Token Number - Extra Large Typography */}
                    <div className="my-auto py-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-white/50 block mb-1">
                        PICKUP TOKEN
                      </span>
                      <div className="font-outfit font-black text-3xl sm:text-4xl md:text-5xl text-amber tracking-tight drop-shadow-[0_2px_12px_rgba(245,158,11,0.35)]">
                        {token}
                      </div>
                    </div>

                    {/* Bottom Status Callout */}
                    <div className="w-full pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/80">
                      <span className="font-bold flex items-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ready
                      </span>
                      <span className="font-mono text-white/50 text-[10px]">
                        {readyTimeStr}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* ================= FOOTER TICKER ================= */}
      <footer className="bg-[#0b3d2e]/80 border-t border-white/10 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
        <div className="flex items-center gap-3">
          <span className="font-outfit font-black text-amber uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Fast Serving
          </span>
          <span className="hidden sm:inline text-white/40">•</span>
          <span className="hidden sm:inline">
            Show your pickup token or QR code at the counter to collect your meal.
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-white/50">
          <span>Synced {lastUpdated.toLocaleTimeString()}</span>
          <span>•</span>
          <span className="text-amber">DRS QUICK SERVE POS v2.0</span>
        </div>
      </footer>

    </div>
  );
};

export default PickupDisplay;

