import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Percent, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [minimumOrder, setMinimumOrder] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get('/coupons');
      if (response.data?.success) {
        setCoupons(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch coupons.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!code.trim() || !discountValue || !expiryDate) return;
    setSuccess('');
    setError('');

    try {
      const response = await API.post('/coupons', {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue,
        minimumOrder,
        expiryDate
      });

      if (response.data?.success) {
        setSuccess('Coupon code created successfully! 🎟️');
        setCode('');
        setDiscountValue('');
        setMinimumOrder('0');
        setExpiryDate('');
        fetchCoupons();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create coupon.');
    }
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Are you sure you want to delete this coupon code?')) return;
    try {
      const response = await API.delete(`/coupons/${id}`);
      if (response.data?.success) {
        setCoupons((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert('Failed to delete coupon.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-20">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-8 flex items-center gap-2">
        <Percent className="w-8 h-8 text-primary" /> Coupon Code Management
      </h1>

      {success && (
        <div className="flex items-center gap-2 bg-primary-light border border-primary/20 text-primary-dark text-xs p-4 rounded-2xl mb-6 font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Create Coupon Form */}
        <div className="bg-white border border-border p-6 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-base text-primary-dark mb-5 border-b border-border pb-3 flex items-center gap-1">
            <Plus className="w-5 h-5 text-primary" /> Add Promo Code
          </h2>
          <form onSubmit={handleAddCoupon} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Coupon Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: DRS50"
                className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all uppercase font-mono tracking-wider"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                >
                  <option value="flat">Flat Value</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Value (₹ or %)</label>
                <input
                  type="number"
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Minimum Order (₹)</label>
              <input
                type="number"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value)}
                className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Expiry Date</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-cream border-2 border-border focus:border-primary focus:bg-white rounded-xl py-2.5 px-3.5 text-xs focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              className="bg-primary-dark hover:bg-primary text-white font-bold py-3 rounded-xl transition-all shadow-md text-xs mt-2"
            >
              Generate Coupon
            </button>
          </form>
        </div>

        {/* Coupons List Table */}
        <div className="lg:col-span-2 bg-white border border-border p-6 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-base text-primary-dark mb-5 border-b border-border pb-3">
            Active Promo Codes
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-cream border-b border-border text-muted font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 rounded-l-2xl">Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4 text-center">Min Order</th>
                  <th className="py-3 px-4 text-center">Expiry</th>
                  <th className="py-3 px-4 text-center rounded-r-2xl">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-primary-dark">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-muted">Loading coupons...</td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-muted">No coupons created yet.</td>
                  </tr>
                ) : (
                  coupons.map((coupon) => (
                    <tr key={coupon._id} className="hover:bg-cream/40 transition-all">
                      <td className="py-4 px-4 font-mono font-bold tracking-wider text-amber-dark uppercase">{coupon.code}</td>
                      <td className="py-4 px-4">
                        {coupon.discountType === 'flat' ? `₹${coupon.discountValue} Flat` : `${coupon.discountValue}% Off`}
                      </td>
                      <td className="py-4 px-4 text-center">₹{coupon.minimumOrder}</td>
                      <td className="py-4 px-4 text-center">{new Date(coupon.expiryDate).toLocaleDateString()}</td>
                      <td className="py-4 px-4 text-center">
                        <button 
                          onClick={() => deleteCoupon(coupon._id)}
                          className="w-8 h-8 bg-red-50 hover:bg-red-500 hover:text-white border border-red-100 text-red-600 rounded-full flex items-center justify-center transition-all mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Coupons;
