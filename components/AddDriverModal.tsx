"use client";

import { useState, useEffect } from "react";
import { X, Save } from 'lucide-react';
import AddressAutocomplete, { Suggestion } from './address-autocomplete';

type Props = {
  companyId: number;
  companyName: string;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
};

export default function AddDriverModal({ companyId, companyName, onClose, onSave, loading }: Props) {
  const [formData, setFormData] = useState({
    cpr: "",
    drFname: "",
    drLname: "",
    sex: "MALE" as "MALE" | "FEMALE",
    drAddress: "",
    drPhone: "",
    drEmail: "",
    drPhoto: null as File | null,
    licenceNr: "",
    drCard: "",
    drUsername: "",
    drPass: "",
  });

  // Function to get last 4 digits from CPR
  const getLast4Digits = (cpr: string): string => {
    const parts = cpr.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : cpr.slice(-4);
  };

  // Auto-fill username and password when drCard and cpr are available
  useEffect(() => {
    if (formData.drCard && formData.cpr) {
      const username = formData.drCard;
      const password = formData.drCard + getLast4Digits(formData.cpr);
      setFormData(prev => ({
        ...prev,
        drUsername: username,
        drPass: password,
      }));
    }
  }, [formData.drCard, formData.cpr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let photoPath = formData.drPhoto;

    // Upload photo if present
    if (formData.drPhoto) {
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', formData.drPhoto);

        const uploadRes = await fetch('/api/upload/driver-photo', {
          method: 'POST',
          body: formDataUpload,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.ok) {
          alert('Failed to upload photo: ' + (uploadData.error || 'Unknown error'));
          return;
        }

        photoPath = uploadData.path;
      } catch (error) {
        alert('Failed to upload photo');
        return;
      }
    }

    onSave({ ...formData, drPhoto: photoPath, comId: companyId });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Add Driver to {companyName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              CPR (Social Security Number)
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.cpr}
              onChange={(e) => setFormData({ ...formData, cpr: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drFname}
                onChange={(e) => setFormData({ ...formData, drFname: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drLname}
                onChange={(e) => setFormData({ ...formData, drLname: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Sex
              </label>
              <select
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value as "MALE" | "FEMALE" })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Phone
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drPhone}
                onChange={(e) => setFormData({ ...formData, drPhone: e.target.value })}
              />
            </div>
          </div>

          <AddressAutocomplete
            label="Address"
            placeholder="Enter Danish address"
            value={formData.drAddress}
            onChange={(value) => setFormData({ ...formData, drAddress: value })}
            onSelect={(suggestion: Suggestion) => {
              const fullAddress = `${suggestion.text}${suggestion.postcode ? `, ${suggestion.postcode}` : ''}${suggestion.city ? ` ${suggestion.city}` : ''}`;
              setFormData({ ...formData, drAddress: fullAddress });
            }}
            name="drAddress"
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Email (Optional)
            </label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.drEmail}
              onChange={(e) => setFormData({ ...formData, drEmail: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setFormData({ ...formData, drPhoto: e.target.files?.[0] || null })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                License Number
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.licenceNr}
                onChange={(e) => setFormData({ ...formData, licenceNr: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Driver Card
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drCard}
                onChange={(e) => setFormData({ ...formData, drCard: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drUsername}
                onChange={(e) => setFormData({ ...formData, drUsername: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drPass}
                onChange={(e) => setFormData({ ...formData, drPass: e.target.value })}
              />
            </div>
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
                Add Driver
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}