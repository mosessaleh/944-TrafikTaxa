"use client";

import { useState, useEffect } from "react";
import { X, Save } from 'lucide-react';

type VehicleType = {
  id: number;
  key: string;
  title: string;
  capacity: number;
  multiplier: number;
};

type Props = {
  companyId: number;
  companyName: string;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
};

export default function AddVehicleModal({ companyId, companyName, onClose, onSave, loading }: Props) {
  const [formData, setFormData] = useState({
    regNumber: "",
    make: "",
    model: "",
    variant: "",
    year: "",
    vinNumber: "",
    seats: "",
    color: "",
    fuel: "",
    taxiPermitNumber: "",
    notes: "",
    vehicleType: "",
  });

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVehicleTypes() {
      try {
        const res = await fetch('/api/vehicle-types');
        const data = await res.json();
        if (data.ok) {
          setVehicleTypes(data.items);
        }
      } catch (error) {
        console.error('Failed to fetch vehicle types:', error);
      } finally {
        setLoadingTypes(false);
      }
    }
    fetchVehicleTypes();
  }, []);

  const handleRegNumberChange = async (value: string) => {
    // Convert to uppercase and filter to only allow English letters and numbers
    const filteredValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setFormData({ ...formData, regNumber: filteredValue });
    setLookupError(null); // Clear previous errors

    // Only clear auto-filled fields if the input becomes empty or invalid
    if (filteredValue.length === 0) {
      setFormData(prev => ({
        ...prev,
        regNumber: '',
        make: '',
        model: '',
        variant: '',
        year: '',
        seats: '',
        color: '',
        fuel: '',
        vinNumber: '',
      }));
      return;
    }

    // Trigger lookup only when exactly 7 characters are entered
    if (filteredValue.length === 7) {
      const regNumberPattern = /^[A-Z]{2}\d{5}$/;
      if (regNumberPattern.test(filteredValue)) {
        setLookupLoading(true);
        try {
          const res = await fetch('/api/vehicle-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regNumber: filteredValue }),
          });

          const data = await res.json();
          console.log('Vehicle lookup response:', data);

          if (data.ok) {
            console.log('Vehicle found:', data.data);
            // Populate the form with the fetched data
            setFormData(prev => ({
              ...prev,
              regNumber: filteredValue,
              make: data.data.make || '',
              model: data.data.model || '',
              variant: data.data.variant || '',
              year: data.data.year?.toString() || '',
              seats: data.data.seats?.toString() || '',
              color: data.data.color || '',
              fuel: data.data.fuel || '',
              vinNumber: data.data.vinNumber || '',
            }));
            setLookupError(null);
          } else {
            console.log('Vehicle not found:', data.error);
            // Vehicle not found
            setLookupError(data.error || 'Vehicle not found');
            // Clear the auto-filled fields
            setFormData(prev => ({
              ...prev,
              regNumber: filteredValue,
              make: '',
              model: '',
              variant: '',
              year: '',
              seats: '',
              color: '',
              fuel: '',
              vinNumber: '',
            }));
          }
        } catch (error) {
          console.error('Failed to lookup vehicle:', error);
          setLookupError('Failed to lookup vehicle information');
        } finally {
          setLookupLoading(false);
        }
      } else {
        setLookupError('Invalid registration number format');
      }
    } else if (filteredValue.length > 7) {
      setLookupError('Registration number too long');
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      comId: companyId,
      regNumber: formData.regNumber,
      make: formData.make,
      model: formData.model,
      variant: formData.variant || undefined,
      year: formData.year ? parseInt(formData.year) : undefined,
      vinNumber: formData.vinNumber || undefined,
      seats: formData.seats ? parseInt(formData.seats) : undefined,
      color: formData.color || undefined,
      fuel: formData.fuel || undefined,
      taxiPermitNumber: formData.taxiPermitNumber || undefined,
      notes: formData.notes || undefined,
      vehicleType: formData.vehicleType || undefined,
    };

    onSave(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Add Vehicle to {companyName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Registration Number *
              </label>
              <div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      lookupError
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-blue-500'
                    }`}
                    value={formData.regNumber}
                    onChange={(e) => handleRegNumberChange(e.target.value)}
                    placeholder="XX12345"
                  />
                  {lookupLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {lookupError && (
                  <p className="text-red-600 text-xs mt-1">{lookupError}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Make
              </label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.make}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Model
              </label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.model}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Variant
              </label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.variant}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Year
              </label>
              <input
                type="number"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.year}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Seats
              </label>
              <input
                type="number"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.seats}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Color
              </label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.color}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Fuel Type
              </label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                value={formData.fuel}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              VIN Number
            </label>
            <input
              type="text"
              readOnly
              className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              value={formData.vinNumber}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Vehicle Type *
            </label>
            <select
              required
              disabled={loadingTypes}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={formData.vehicleType}
              onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
            >
              <option value="">
                {loadingTypes ? 'Loading vehicle types...' : 'Select vehicle type'}
              </option>
              {vehicleTypes.map((type) => (
                <option key={type.id} value={type.key}>
                  {type.title} (Capacity: {type.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Taxi Permit Number *
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.taxiPermitNumber}
              onChange={(e) => setFormData({ ...formData, taxiPermitNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Notes *
            </label>
            <textarea
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading}
          >
            {loading ? "Saving..." : (
              <>
                <Save size={16} />
                Add Vehicle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}