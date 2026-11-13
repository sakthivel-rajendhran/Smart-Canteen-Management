import React, { useState, useEffect } from 'react';
import { Package, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../services/api';

/**
 * Singleton Admin Parcel Configuration panel backed by CanteenSettings.
 */
export default function ParcelSettingsCard({ socket }) {
  const [parcelEnabled, setParcelEnabled] = useState(true);
  const [parcelChargeInput, setParcelChargeInput] = useState('5');
  const [savedConfig, setSavedConfig] = useState({ enabled: true, charge: '5' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const syncFromPayload = (data) => {
    if (!data) return;
    const enabled = data.parcelEnabled !== false;
    const charge = String(data.parcelChargePerItem ?? 5);
    setParcelEnabled(enabled);
    setParcelChargeInput(charge);
    setSavedConfig({ enabled, charge });
  };

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await API.get('/admin/settings/parcel');
        if (active && res.data?.success && res.data.data) {
          syncFromPayload(res.data.data);
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || 'Failed to load parcel settings.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdated = (payload) => syncFromPayload(payload);
    socket.on('parcel:settingsUpdated', handleUpdated);
    return () => {
      socket.off('parcel:settingsUpdated', handleUpdated);
    };
  }, [socket]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const parsed = Number(parcelChargeInput);
    if (parcelChargeInput === '' || !Number.isFinite(parsed)) {
      setError('Please enter a valid number for parcel charge.');
      return;
    }
    if (parsed < 0) {
      setError('Parcel charge cannot be negative.');
      return;
    }

    try {
      setSaving(true);
      const res = await API.put('/admin/settings/parcel', {
        parcelEnabled,
        parcelChargePerItem: parsed,
      });
      if (res.data?.success && res.data.data) {
        syncFromPayload(res.data.data);
        setSuccessMsg('Parcel settings saved and applied live!');
        setTimeout(() => setSuccessMsg(''), 3500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save parcel settings.');
    } finally {
      setSaving(false);
    }
  };

  const previewCharge = Math.max(0, Number(parcelChargeInput) || 0);
  const hasUnsavedChanges =
    !loading &&
    (parcelEnabled !== savedConfig.enabled ||
      String(parcelChargeInput).trim() !== String(savedConfig.charge).trim());

  return (
    <div
      data-testid="parcel-settings-card"
      className="bg-white border border-border rounded-3xl p-4 sm:p-5 shadow-sm mb-6"
    >
      <form
        onSubmit={handleSave}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        {/* Left Section: Icon, Title, Status Badge & Short Description */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-amber/15 border border-amber/30 flex items-center justify-center shrink-0 text-amber-dark">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-outfit font-bold text-primary-dark text-sm sm:text-base leading-tight">
                Parcel Packaging Settings
              </h3>
              <span
                data-testid="parcel-status-badge"
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                  parcelEnabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {parcelEnabled ? 'Parcel ON' : 'Parcel OFF'}
              </span>
              {hasUnsavedChanges && (
                <span
                  data-testid="parcel-unsaved-badge"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-light text-amber-dark border border-amber/30 shrink-0"
                >
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="text-muted text-xs mt-1 leading-snug">
              {parcelEnabled
                ? `Food Items / Juices: Normal (₹0 extra) or Parcel (+₹${previewCharge} per item). Snacks remain Normal-only.`
                : 'Parcel selection is hidden across all categories and disabled on orders.'}
            </p>
          </div>
        </div>

        {/* Right Section: Toggle, Charge Input & Save Button in One Aligned Row */}
        <div
          data-testid="parcel-controls-row"
          className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 shrink-0 w-full lg:w-auto"
        >
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => {
              setError('');
              setSuccessMsg('');
              setParcelEnabled((prev) => !prev);
            }}
            aria-pressed={parcelEnabled}
            data-testid="toggle-parcel-enabled"
            className={`h-10 inline-flex items-center justify-center gap-2 px-3.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              parcelEnabled
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm hover:bg-emerald-700'
                : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                parcelEnabled ? 'bg-white' : 'bg-stone-400'
              }`}
            />
            <span>Parcel Option: {parcelEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div className="h-10 flex items-center gap-2 bg-cream border border-border rounded-xl px-3 shrink-0">
            <label
              htmlFor="parcelChargeInput"
              className="text-[11px] font-bold text-primary-dark whitespace-nowrap"
            >
              Charge / Item (₹)
            </label>
            <input
              id="parcelChargeInput"
              data-testid="input-parcel-charge"
              type="number"
              min="0"
              step="1"
              disabled={loading || saving}
              value={parcelChargeInput}
              onChange={(e) => {
                setError('');
                setSuccessMsg('');
                setParcelChargeInput(e.target.value);
              }}
              className="w-16 bg-white border border-border focus:border-primary rounded-lg px-2 py-1 text-xs font-bold text-primary-dark text-right focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || saving}
            data-testid="save-parcel-settings"
            className="h-10 inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white font-bold text-xs px-4 rounded-xl transition-all shadow-sm disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
