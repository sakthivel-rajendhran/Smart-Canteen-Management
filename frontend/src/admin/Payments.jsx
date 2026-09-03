import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { BadgeIndianRupee, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get('/payments/admin/list');
      if (response.data?.success) {
        setPayments(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch payment records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit font-black text-3xl text-primary-dark mb-1 flex items-center gap-2">
            <BadgeIndianRupee className="w-8 h-8 text-primary" /> Payment Transactions
          </h1>
          <p className="text-muted text-xs">View all digital transaction capturing logs from Razorpay API.</p>
        </div>
        <button 
          onClick={fetchPayments} 
          className="bg-cream hover:bg-gray-100 text-primary-dark border border-border font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 focus:outline-none"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-cream border-b border-border text-muted font-bold uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-2xl">Order Code</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Amount</th>
                <th className="py-3 px-4">Razorpay Payment ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center rounded-r-2xl">Transaction Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold text-primary-dark">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-muted">Loading payments...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-muted">No online payments captured yet.</td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-cream/40 transition-all">
                    <td className="py-4 px-4 font-mono font-bold tracking-wider text-amber-dark">{payment.order?.orderCode || '—'}</td>
                    <td className="py-4 px-4">
                      <div>
                        <span className="font-bold block mb-0.5">{payment.order?.user?.name || 'Walkin'}</span>
                        <span className="text-[10px] text-muted font-medium block">{payment.order?.user?.email || 'Guest'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-bold">₹{payment.amount}</td>
                    <td className="py-4 px-4 font-mono text-[11px] text-muted">{payment.razorpayPaymentId || '—'}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-[10px] inline-flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Captured
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-muted text-[11px]">
                      {new Date(payment.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Payments;
