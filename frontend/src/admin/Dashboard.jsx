import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  IndianRupee,
  Utensils,
  BarChart4,
  RefreshCw,
  Sparkles,
  Layers,
  Percent,
  BadgeIndianRupee,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie
} from 'recharts';

const Dashboard = () => {
  const [overview, setOverview] = useState({ totalOrders: 0, totalRevenue: 0, statusBreakdown: {} });
  const [revenueData, setRevenueData] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardAnalytics(true);
  }, []);

  const fetchDashboardAnalytics = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');
      
      const [overRes, revRes, popRes, payRes] = await Promise.all([
        API.get('/analytics/overview'),
        API.get('/analytics/revenue'),
        API.get('/analytics/popular-items'),
        API.get('/analytics/payments')
      ]);

      if (overRes.data?.success) setOverview(overRes.data.data);
      if (revRes.data?.success) setRevenueData(revRes.data.data);
      if (popRes.data?.success) setPopularItems(popRes.data.data);
      if (payRes.data?.success) {
        // Map backend details to Recharts friendly format
        const formattedPayments = payRes.data.data.map(item => ({
          name: item._id === 'cod' ? 'Cash Counter' : 'Online Razorpay',
          value: item.count,
          revenue: item.revenue
        }));
        setPaymentsData(formattedPayments);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const COLORS = ['#1A7A45', '#F59E0B', '#dc2626'];

  const pendingCount = (overview.statusBreakdown?.Placed || 0) + (overview.statusBreakdown?.Confirmed || 0);
  const preparingCount = overview.statusBreakdown?.Preparing || 0;
  const readyCount = overview.statusBreakdown?.Ready || 0;

  // Custom Glassmorphic Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary-darker/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl text-white text-xs">
          <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider mb-1">{label}</p>
          <p className="font-outfit font-black text-amber flex items-center gap-1">
            <span>{payload[0].name}:</span>
            <span className="text-white font-mono">{prefix}{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs">🍛</div>
        </div>
        <span className="text-muted text-xs font-bold mt-4 tracking-wide uppercase">Loading smart metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl mt-12 shadow-xl">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="font-outfit font-black text-2xl text-primary-dark mb-2">Analytics Sync Error</h3>
        <p className="text-muted text-sm mb-6 leading-relaxed">{error}</p>
        <button 
          onClick={() => fetchDashboardAnalytics(true)} 
          className="bg-primary hover:bg-primary-dark text-white font-bold px-7 py-3 rounded-xl transition-all shadow-md active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-20 font-inter text-text">
      
      {/* Title & Top Options Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-primary/10 border border-primary/25 text-primary text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 animate-pulse">
              <Activity className="w-3 h-3" /> Live Operations
            </span>
            <span className="text-[10px] text-muted font-bold font-mono">Synced {new Date().toLocaleTimeString()}</span>
          </div>
          <h1 className="font-outfit font-black text-3xl md:text-4xl text-primary-dark tracking-tight flex items-center gap-2">
            <BarChart4 className="w-9 h-9 text-primary drop-shadow-[0_2px_8px_rgba(26,122,69,0.2)]" /> Admin Analytics
          </h1>
        </div>

        <button
          onClick={() => fetchDashboardAnalytics(false)}
          disabled={refreshing}
          className="bg-white/80 hover:bg-white border border-border/80 text-primary-dark hover:text-primary font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center gap-2 shadow-sm hover:shadow active:scale-95 focus:outline-none disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
        </button>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-gradient-to-r from-primary-dark to-primary-darker text-white p-6 rounded-3xl shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="z-10">
          <h2 className="font-outfit font-black text-lg md:text-xl flex items-center gap-1.5 text-white">
            <Sparkles className="w-5 h-5 text-amber animate-bounce" /> DRS Smart Operations Hub
          </h2>
          <p className="text-white/60 text-xs mt-1 max-w-xl">
            Quickly jump to specialized control panels to manage live order statuses, add food categories, modify menus, update coupons, or review Razorpay logs.
          </p>
        </div>

        {/* Action Link Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 font-outfit">
          {[
            { label: 'Live Tracking', path: '/admin/live-tracking', icon: <Layers className="w-4.5 h-4.5" />, color: 'bg-white/10 hover:bg-white/20' },
            { label: 'Menu List', path: '/admin/menu', icon: <Utensils className="w-4.5 h-4.5" />, color: 'bg-white/10 hover:bg-white/20' },
            { label: 'Promo Codes', path: '/admin/coupons', icon: <Percent className="w-4.5 h-4.5" />, color: 'bg-white/10 hover:bg-white/20' },
            { label: 'Payments', path: '/admin/payments', icon: <BadgeIndianRupee className="w-4.5 h-4.5" />, color: 'bg-white/10 hover:bg-white/20' }
          ].map((action, idx) => (
            <Link 
              key={idx}
              to={action.path}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl text-[11px] font-bold transition-all text-white border border-white/5 active:scale-95 ${action.color}`}
            >
              <div className="mb-1 text-amber">{action.icon}</div>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { 
            label: "Today's Revenue", 
            val: `₹${overview.totalRevenue}`, 
            icon: <IndianRupee className="w-5 h-5 text-green-600" />, 
            bg: "bg-green-50/50 border-green-100 hover:shadow-green-100", 
            barColor: "bg-green-500" 
          },
          { 
            label: 'Total Orders Placed', 
            val: overview.totalOrders, 
            icon: <ShoppingBag className="w-5 h-5 text-primary" />, 
            bg: "bg-primary-light/50 border-primary/10 hover:shadow-emerald-100", 
            barColor: "bg-primary" 
          },
          { 
            label: 'Pending / Preparing', 
            val: `${pendingCount} / ${preparingCount}`, 
            icon: <Clock className="w-5 h-5 text-amber-dark" />, 
            bg: "bg-amber-light/40 border-amber-100 hover:shadow-amber-100", 
            barColor: "bg-amber" 
          },
          { 
            label: 'Ready to Collect', 
            val: readyCount, 
            icon: <CheckCircle className="w-5 h-5 text-blue-600" />, 
            bg: "bg-blue-50/40 border-blue-100 hover:shadow-blue-100", 
            barColor: "bg-blue-500" 
          }
        ].map((card, idx) => (
          <div 
            key={idx} 
            className={`bg-white/70 backdrop-blur-md border p-5 md:p-6 rounded-3xl flex flex-col justify-between shadow-[0_4px_20px_0_rgba(0,0,0,0.02)] hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group ${card.bg}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[9px] text-muted font-extrabold uppercase tracking-wider block mb-1 font-outfit">{card.label}</span>
                <span className="font-outfit font-black text-2xl md:text-3xl text-primary-dark block leading-none">{card.val}</span>
              </div>
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-border/40 group-hover:scale-110 transition-transform">
                {card.icon}
              </div>
            </div>
            {/* Visual indicator bar */}
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${card.barColor} w-2/3 group-hover:w-full transition-all duration-700`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Weekly Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/80 p-6 rounded-3xl shadow-[0_4px_25px_0_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-outfit font-bold text-base text-primary-dark flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-primary" /> Weekly Canteen Sales Trend
            </h3>
            <span className="text-[10px] bg-primary-light text-primary-dark font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-outfit">Revenue (₹)</span>
          </div>
          
          <div className="h-72">
            {revenueData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted text-xs gap-1.5">
                <span className="text-xl">📊</span>
                <span>No transaction records registered inside the past 7 days.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1A7A45" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1A7A45" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="_id" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
                  <Tooltip content={<CustomTooltip prefix="₹" />} cursor={{ stroke: 'rgba(26,122,69,0.1)', strokeWidth: 1.5 }} />
                  <Area type="monotone" dataKey="revenue" name="Daily Revenue" stroke="#1A7A45" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Distribution Pie Chart */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 p-6 rounded-3xl shadow-[0_4px_25px_0_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <h3 className="font-outfit font-bold text-base text-primary-dark mb-6 flex items-center gap-1.5">
            <BadgeIndianRupee className="w-5 h-5 text-amber-dark" /> Payment Distribution
          </h3>
          
          <div className="h-56 flex flex-col items-center justify-center relative">
            {paymentsData.length === 0 ? (
              <span className="text-muted text-xs">No records available.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none hover:opacity-90 transition-opacity cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100 text-xs font-semibold text-muted">
            {paymentsData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-lg inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-primary-dark">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-primary-dark font-black mr-2">{item.value} checkouts</span>
                  <span className="text-[10px] text-muted">(₹{item.revenue || 0})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Popular Items bar charts */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/80 p-6 rounded-3xl shadow-[0_4px_25px_0_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-outfit font-bold text-base text-primary-dark flex items-center gap-1.5">
              <Utensils className="w-5 h-5 text-primary" /> Popular Canteen Dishes
            </h3>
            <span className="text-[10px] bg-amber-light text-amber-dark font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-outfit">Top 5 Dishes</span>
          </div>

          <div className="h-64">
            {popularItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted text-xs">No foods purchased yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularItems} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="_id" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.05)' }} />
                  <Bar dataKey="quantity" name="Quantity Sold" fill="#F59E0B" radius={[8, 8, 0, 0]} barSize={32}>
                    {popularItems.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#1A7A45' : '#F59E0B'} className="hover:opacity-90 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Current status breakdowns */}
        <div className="bg-white/70 backdrop-blur-md border border-white/80 p-6 rounded-3xl shadow-[0_4px_25px_0_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="font-outfit font-bold text-base text-primary-dark mb-1">Status Frequency List</h3>
            <p className="text-muted text-[10px] font-medium mb-6">Percentage breakdown of orders per stage.</p>
          </div>

          <div className="flex flex-col gap-4.5">
            {Object.entries(overview.statusBreakdown || {}).map(([key, value]) => {
              const percentage = overview.totalOrders > 0 ? Math.round((value / overview.totalOrders) * 100) : 0;
              
              // Map colors per status
              let pillColor = 'bg-gray-100 text-gray-700';
              let progressColor = 'bg-gray-400';
              if (key === 'Placed') { pillColor = 'bg-rose-50 text-rose-700'; progressColor = 'bg-rose-500'; }
              else if (key === 'Confirmed') { pillColor = 'bg-blue-50 text-blue-700'; progressColor = 'bg-blue-500'; }
              else if (key === 'Preparing') { pillColor = 'bg-amber-light text-amber-dark'; progressColor = 'bg-amber'; }
              else if (key === 'Ready') { pillColor = 'bg-green-50 text-green-700'; progressColor = 'bg-green-600'; }
              else if (key === 'Completed') { pillColor = 'bg-green-100 text-green-900'; progressColor = 'bg-primary-dark'; }
              else if (key === 'Cancelled') { pillColor = 'bg-red-50 text-red-700'; progressColor = 'bg-red-500'; }

              return (
                <div key={key} className="flex flex-col gap-1.5 text-xs font-semibold">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${pillColor}`}>{key}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary-dark font-black">{value}</span>
                      <span className="text-[10px] text-muted">({percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/40">
                    <div 
                      className={`h-full ${progressColor} rounded-full transition-all duration-1000`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
