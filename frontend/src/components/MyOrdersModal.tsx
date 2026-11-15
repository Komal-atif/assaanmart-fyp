import React, { useEffect, useState } from 'react';
import { X, Package, ChevronDown, ChevronUp, Mic, ShoppingBag, Loader2, RefreshCw } from 'lucide-react';
import { fetchMyOrders, MyOrder } from '../services/orderApi';
import { User } from '../types';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const when = (s: string) => {
  // the server stores UTC without a time-zone mark
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({ isOpen, onClose, user }) => {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await fetchMyOrders());
    } catch (e: any) {
      setError(
        /401|login/i.test(String(e?.message))
          ? 'Please sign in to see your orders.'
          : "Couldn't load your orders. Make sure the AssanMart server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) load();
  }, [isOpen, user?.email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh]">
        <div className="p-4 sm:p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-lg font-black text-slate-900">My Orders</h3>
            <p className="text-xs text-slate-500">{user ? `Orders placed by ${user.name}` : 'Sign in to see your orders'}</p>
          </div>
          <div className="flex items-center gap-1">
            {user && (
              <button
                onClick={load}
                disabled={loading}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3">
          {!user ? (
            <p className="text-sm text-slate-500 text-center py-10">Please sign in to see your past orders.</p>
          ) : loading && orders.length === 0 ? (
            <div className="py-10 flex justify-center text-[#46a468]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm font-semibold text-red-600 text-center py-10">{error}</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">You haven't placed any orders yet.</p>
            </div>
          ) : (
            orders.map((o) => {
              const isOpenRow = openId === o.id;
              return (
                <div key={o.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpenRow ? null : o.id)}
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#f3fbf6] text-[#46a468] flex items-center justify-center shrink-0">
                      {o.source === 'voice' ? <Mic className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        Order #AM-{o.id}
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e0f4e7] text-[#2a6b43] uppercase">
                          {o.status}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {when(o.created_at)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}
                        {o.source === 'voice' ? ' · by voice' : ''}
                      </p>
                    </div>
                    <span className="text-sm font-black text-[#378553] shrink-0">PKR {Math.round(o.total).toLocaleString()}</span>
                    {isOpenRow ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isOpenRow && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 text-xs space-y-3">
                      <ul className="divide-y divide-slate-200 pt-2">
                        {o.items.map((it, i) => (
                          <li key={i} className="py-2 flex justify-between gap-3">
                            <span className="text-slate-700">
                              {it.quantity} × {it.name}
                            </span>
                            <span className="font-semibold text-slate-900 shrink-0">
                              PKR {Math.round(it.line_total).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-1 text-slate-600">
                        {o.subtotal != null && (
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>PKR {Math.round(o.subtotal).toLocaleString()}</span>
                          </div>
                        )}
                        {o.delivery_fee != null && (
                          <div className="flex justify-between">
                            <span>Delivery</span>
                            <span>{o.delivery_fee === 0 ? 'FREE' : `PKR ${Math.round(o.delivery_fee)}`}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>Total</span>
                          <span>PKR {Math.round(o.total).toLocaleString()}</span>
                        </div>
                      </div>
                      {(o.address || o.payment_method) && (
                        <p className="text-slate-500">
                          {o.address ? `Deliver to: ${o.address}${o.city ? ', ' + o.city : ''}` : ''}
                          {o.address && o.payment_method ? ' · ' : ''}
                          {o.payment_method ?? ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};