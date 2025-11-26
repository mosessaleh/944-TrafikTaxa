"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Car,
  Edit2,
  Trash2,
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Save,
  X,
} from 'lucide-react';

export type PartnerVehicle = {
  id: number;
  comId: number;
  uId?: number | null;
  vehicleType?: string | null;
  regNumber: string;
  make: string;
  model: string;
  variant?: string | null;
  year?: number | null;
  vinNumber?: string | null;
  seats?: number | null;
  color?: string | null;
  fuel?: string | null;
  status: number;
  taxiPermitNumber?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  company: {
    comName: string;
  };
};

type Props = {
  initialVehicles: PartnerVehicle[];
};

type ActionMessage = { type: "success" | "error"; text: string } | null;

export default function AdminPartnerVehiclesClient({ initialVehicles }: Props) {
  const [vehicles, setVehicles] = useState<PartnerVehicle[]>(initialVehicles);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<PartnerVehicle | null>(null);

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vehicles;

    return vehicles.filter((v) =>
      v.regNumber.toLowerCase().includes(term) ||
      v.make.toLowerCase().includes(term) ||
      v.model.toLowerCase().includes(term) ||
      v.company.comName.toLowerCase().includes(term) ||
      String(v.id).includes(term)
    );
  }, [vehicles, searchTerm]);

  function openEditModal(vehicle: PartnerVehicle) {
    setActionMessage(null);
    setEditVehicle(vehicle);
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditVehicle(null);
  }

  async function handleUpdateVehicle(formData: any) {
    if (!editVehicle) return;
    setLoading(true);
    setActionMessage(null);
    try {
      // Convert string values back to appropriate types
      const dataToSend = {
        ...formData,
        year: formData.year ? parseInt(formData.year) : undefined,
        seats: formData.seats ? parseInt(formData.seats) : undefined,
        status: formData.status ? 1 : 0,
      };

      const res = await fetch(`/api/com-vehicles/${editVehicle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update vehicle");
      }

      setVehicles((prev) =>
        prev.map((v) => (v.id === data.data.id ? { ...data.data, company: v.company } : v))
      );
      setActionMessage({ type: "success", text: "Vehicle updated successfully." });
      closeEditModal();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to update vehicle",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteVehicle(id: number) {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;

    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/com-vehicles/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete vehicle");
      }

      setVehicles((prev) => prev.filter((v) => v.id !== id));
      setActionMessage({ type: "success", text: "Vehicle deleted successfully." });
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to delete vehicle",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Company Vehicles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage vehicles belonging to partner companies.
        </p>
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
              placeholder="Search by reg number, make, model..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Vehicles table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3">Make & Model</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVehicles.map((v) => (
                <tr
                  key={v.id}
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-4 py-3 text-gray-500">#{v.id}</td>
                  <td className="px-4 py-3 font-medium">{v.regNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Car size={16} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                        {v.variant && <div className="text-xs text-gray-500">{v.variant}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building size={16} className="text-gray-400" />
                      <span className="text-sm">{v.company.comName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {v.status === 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        <CheckCircle size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        <AlertTriangle size={12} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(v)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Vehicle"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Vehicle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Search size={24} className="text-gray-400" />
                      </div>
                      <p>No vehicles found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Vehicle Modal */}
      {showEditModal && editVehicle && (
        <VehicleModal
          title="Edit Vehicle"
          onClose={closeEditModal}
          onSave={handleUpdateVehicle}
          loading={loading}
          initialData={editVehicle}
          isEdit={true}
        />
      )}
    </div>
  );
}

type VehicleModalProps = {
  title: string;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
  initialData: PartnerVehicle;
  isEdit?: boolean;
};

function VehicleModal({ title, onClose, onSave, loading, initialData, isEdit = false }: VehicleModalProps) {
  const [formData, setFormData] = useState({
    ...initialData,
    year: initialData.year || "",
    seats: initialData.seats || "",
  });
  const [vehicleTypes, setVehicleTypes] = useState<Array<{id: number, key: string, title: string, capacity: number, multiplier: number}>>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

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
                Registration Number
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.regNumber}
                onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Vehicle Type
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.vehicleType || ""}
                onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                disabled={loadingTypes}
              >
                <option value="">
                  {loadingTypes ? "Loading..." : "Select Type"}
                </option>
                {vehicleTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.title} ({type.capacity} seats)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Make
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Model
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
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
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Variant
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.variant || ""}
                onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Seats
              </label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.seats}
                onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.color || ""}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Fuel Type
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.fuel || ""}
                onChange={(e) => setFormData({ ...formData, fuel: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              VIN Number
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.vinNumber || ""}
              onChange={(e) => setFormData({ ...formData, vinNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Taxi Permit Number
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.taxiPermitNumber || ""}
              onChange={(e) => setFormData({ ...formData, taxiPermitNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.status === 1}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 1 : 0 })}
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
                {isEdit ? "Update" : "Add"} Vehicle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}