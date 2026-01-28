"use client";

import { useMemo, useState } from "react";
import {
  Search,
  User,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Save,
  AlertTriangle,
  FileText,
  Shield,
  ShieldOff,
} from 'lucide-react';

// Import CPR masking function
function maskCPR(cpr: string, showLastDigits: number = 4): string {
  if (cpr.length <= showLastDigits) return cpr;
  return 'X'.repeat(cpr.length - showLastDigits) + cpr.slice(-showLastDigits);
}

export type Driver = {
  id: number;
  comId: number;
  companyName: string;
  cpr: string;
  drFname: string;
  drLname: string;
  sex: 'MALE' | 'FEMALE';
  drAddress: string;
  drPhone: string;
  drEmail?: string | null;
  drPhoto?: string | null;
  licenceNr: string;
  drCard: string;
  rating: number;
  isOnline: boolean;
  isActive: boolean;
  isBusy: boolean;
  bannedUntil?: string | null;
  car?: string | null;
  currentRideId?: number | null;
  drUsername: string;
  apiKey?: string | null;
  createdAt?: string | null;
};

type Company = {
  id: number;
  comName: string;
};

type Props = {
  initialDrivers: Driver[];
  companies: Company[];
};

type ActionMessage = { type: "success" | "error"; text: string } | null;

export default function AdminDriversClient({ initialDrivers, companies }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [searchTerm, setSearchTerm] = useState("");

  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [banDriver, setBanDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

  const filteredDrivers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return drivers;

    return drivers.filter((d) =>
      d.drFname.toLowerCase().includes(term) ||
      d.drLname.toLowerCase().includes(term) ||
      d.drUsername.toLowerCase().includes(term) ||
      d.companyName.toLowerCase().includes(term) ||
      String(d.id).includes(term)
    );
  }, [drivers, searchTerm]);

  function openEdit(driver: Driver) {
    setActionMessage(null);
    setEditDriver({ ...driver });
  }

  function closeEdit() {
    setEditDriver(null);
  }

  async function handleUpdateDriver(formData: any) {
    if (!editDriver) return;
    setLoading(true);
    setActionMessage(null);
    try {
      let photoPath = formData.drPhoto;

      // Upload photo if present
      if (formData.drPhotoFile) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', formData.drPhotoFile);

          const uploadRes = await fetch('/api/upload/driver-photo', {
            method: 'POST',
            body: formDataUpload,
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok || !uploadData.ok) {
            throw new Error('Failed to upload photo: ' + (uploadData.error || 'Unknown error'));
          }

          photoPath = uploadData.path;
        } catch (error: any) {
          throw new Error('Failed to upload photo: ' + error.message);
        }
      }

      const updateData = { ...formData, drPhoto: photoPath };
      delete updateData.drPhotoFile; // Remove the file from the data

      const res = await fetch(`/api/com-drivers/${editDriver.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update driver");
      }

      setDrivers((prev) =>
        prev.map((d) => (d.id === data.data.id ? data.data : d))
      );
      setActionMessage({ type: "success", text: "Driver updated successfully." });
      closeEdit();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to update driver",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDriver(id: number) {
    if (!confirm("Are you sure you want to delete this driver?")) return;

    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/com-drivers/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete driver");
      }

      setDrivers((prev) => prev.filter((d) => d.id !== id));
      setActionMessage({ type: "success", text: "Driver deleted successfully." });
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to delete driver",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleBusy(id: number, currentBusy: boolean) {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/drivers/${id}/toggle-busy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busy: !currentBusy }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to toggle busy status");
      }

      setDrivers((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isBusy: !currentBusy } : d))
      );
      setActionMessage({ type: "success", text: `Driver ${!currentBusy ? 'set as busy' : 'set as available'} successfully.` });
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to toggle busy status",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleToggleBan(driver: Driver) {
    setActionMessage(null);
    setBanDriver(driver);
  }

  function closeBanModal() {
    setBanDriver(null);
  }

  async function handleBanDriver(banData: { duration?: number; unit?: 'hours' | 'days' | 'weeks' }) {
    if (!banDriver) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/drivers/${banDriver.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(banData),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to ban/unban driver");
      }

      setDrivers((prev) =>
        prev.map((d) => (d.id === banDriver.id ? { ...d, bannedUntil: data.bannedUntil } : d))
      );
      setActionMessage({ type: "success", text: `Driver ${banData.duration ? 'banned' : 'unbanned'} successfully.` });
      closeBanModal();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to ban/unban driver",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage drivers for partner companies.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {actionMessage.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {actionMessage.text}
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, username, or company..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Drivers table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3">Driver Card</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">API Key</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Busy</th>
                <th className="px-4 py-3">Banned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrivers.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-4 py-3 text-gray-500">#{d.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {d.drPhoto ? (
                          <img
                            src={d.drPhoto}
                            alt={`${d.drFname} ${d.drLname}`}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                            <User size={16} />
                          </div>
                        )}
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                          d.isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                      <div className="font-medium text-gray-900">{d.drCard}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.companyName}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-800 max-w-32 truncate" title={d.apiKey || 'No API Key'}>
                      {d.apiKey ? `${d.apiKey.slice(0, 8)}...` : 'No API Key'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      d.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleBusy(d.id, d.isBusy)}
                      className={`text-xs px-2 py-1 rounded-full transition-colors ${
                        d.isBusy ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      }`}
                      title={d.isBusy ? 'Set as available' : 'Set as busy'}
                    >
                      {d.isBusy ? 'Busy' : 'Available'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {d.bannedUntil ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                        Banned until {new Date(d.bannedUntil).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                        Not Banned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggleBan(d)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          d.bannedUntil ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={d.bannedUntil ? 'Unban Driver' : 'Ban Driver'}
                      >
                        {d.bannedUntil ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Driver"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(d.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Driver"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDrivers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Search size={24} className="text-gray-400" />
                      </div>
                      <p>No drivers found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Edit Driver Modal */}
      {editDriver && (
        <DriverModal
          title="Edit Driver"
          onClose={closeEdit}
          onSave={handleUpdateDriver}
          loading={loading}
          initialData={editDriver}
          isEdit={true}
          companies={companies}
        />
      )}

      {/* Ban Driver Modal */}
      {banDriver && (
        <BanDriverModal
          driver={banDriver}
          onClose={closeBanModal}
          onSave={handleBanDriver}
          loading={loading}
        />
      )}
    </div>
  );
}

type BanModalProps = {
  driver: Driver;
  onClose: () => void;
  onSave: (data: { duration?: number; unit?: 'hours' | 'days' | 'weeks' }) => void;
  loading: boolean;
};

function BanDriverModal({ driver, onClose, onSave, loading }: BanModalProps) {
  const [duration, setDuration] = useState<number>(1);
  const [unit, setUnit] = useState<'hours' | 'days' | 'weeks'>('hours');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (driver.bannedUntil) {
      // Unban
      onSave({});
    } else {
      // Ban
      onSave({ duration, unit });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">
            {driver.bannedUntil ? 'Unban Driver' : 'Ban Driver'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-600">
              {driver.drFname} {driver.drLname} ({driver.drCard})
            </p>
          </div>

          {driver.bannedUntil ? (
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-4">
                This driver is currently banned until {new Date(driver.bannedUntil).toLocaleString()}.
                Are you sure you want to unban them?
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ban Duration
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'hours' | 'days' | 'weeks')}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>
            </div>
          )}
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
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 ${
              driver.bannedUntil ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            }`}
            disabled={loading}
          >
            {loading ? "Processing..." : (
              <>
                {driver.bannedUntil ? 'Unban Driver' : 'Ban Driver'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type ModalProps = {
  title: string;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
  initialData: any;
  isEdit?: boolean;
};

function DriverModal({ title, onClose, onSave, loading, initialData, isEdit = false, companies }: ModalProps & { companies: Company[] }) {
  const [formData, setFormData] = useState({ ...initialData, drPhotoFile: null as File | null });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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
                Company
              </label>
              <select
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.comId}
                onChange={(e) => setFormData({ ...formData, comId: parseInt(e.target.value) || 0 })}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.comName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                CPR
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.cpr}
                onChange={(e) => setFormData({ ...formData, cpr: e.target.value })}
              />
            </div>
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
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
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

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Address
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.drAddress}
              onChange={(e) => setFormData({ ...formData, drAddress: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Email (Optional)
            </label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.drEmail || ""}
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
              onChange={(e) => setFormData({ ...formData, drPhotoFile: e.target.files?.[0] || null })}
            />
            {formData.drPhoto && (
              <p className="text-xs text-gray-500 mt-1">Current photo will be replaced if a new file is selected.</p>
            )}
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
                Password {isEdit ? "(Leave empty to keep current)" : ""}
              </label>
              <input
                type="password"
                required={!isEdit}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.drPass || ""}
                onChange={(e) => setFormData({ ...formData, drPass: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Active Status</span>
            </label>
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
                {isEdit ? "Update" : "Add"} Driver
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}