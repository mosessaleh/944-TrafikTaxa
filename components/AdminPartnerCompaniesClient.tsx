"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Building,
  Edit2,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  X,
  Save,
  AlertTriangle,
  FileText,
  UserPlus,
  Car,
} from 'lucide-react';
import AddDriverModal from './AddDriverModal';

export type PartnerCompany = {
  id: number;
  cvr?: string | null;
  comName: string;
  contactPerson: string;
  comAddress: string;
  comPhone: string;
  comEmail?: string | null;
  comBankInfo?: string | null;
  comStatus: boolean;
  commissionRate: number;
  contractSigned: boolean;
  comUserName: string;
  comPass?: string; // For forms only
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Props = {
  initialPartners: PartnerCompany[];
};

type ActionMessage = { type: "success" | "error"; text: string } | null;

export default function AdminPartnerCompaniesClient({ initialPartners }: Props) {
  const [partners, setPartners] = useState<PartnerCompany[]>(initialPartners);
  const [searchTerm, setSearchTerm] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editPartner, setEditPartner] = useState<PartnerCompany | null>(null);
  const [showAddDriverModal, setShowAddDriverModal] = useState<{ companyId: number; companyName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

  const filteredPartners = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return partners;

    return partners.filter((p) =>
      p.comName.toLowerCase().includes(term) ||
      (p.cvr || "").toLowerCase().includes(term) ||
      String(p.id).includes(term)
    );
  }, [partners, searchTerm]);

  function openAddModal() {
    setActionMessage(null);
    setShowAddModal(true);
  }

  function closeAddModal() {
    setShowAddModal(false);
  }

  function openEdit(partner: PartnerCompany) {
    setActionMessage(null);
    setEditPartner({ ...partner });
  }

  function closeEdit() {
    setEditPartner(null);
  }

  function openAddDriver(companyId: number, companyName: string) {
    setActionMessage(null);
    setShowAddDriverModal({ companyId, companyName });
  }

  function closeAddDriver() {
    setShowAddDriverModal(null);
  }

  async function handleAddPartner(formData: Omit<PartnerCompany, 'id' | 'createdAt' | 'updatedAt'>) {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/partner-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to add partner");
      }

      setPartners((prev) => [data.data, ...prev]);
      setActionMessage({ type: "success", text: "Partner added successfully." });
      closeAddModal();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to add partner",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePartner(formData: any) {
    if (!editPartner) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const updateData: any = {
        cvr: formData.cvr,
        comName: formData.comName,
        contactPerson: formData.contactPerson,
        comAddress: formData.comAddress,
        comPhone: formData.comPhone,
        comEmail: formData.comEmail,
        comBankInfo: formData.comBankInfo,
        comStatus: formData.comStatus,
        commissionRate: formData.commissionRate,
        contractSigned: formData.contractSigned,
        comUserName: formData.comUserName,
      };
      if (formData.comPass && formData.comPass.trim()) {
        updateData.comPass = formData.comPass;
      }

      const res = await fetch(`/api/partner-companies/${editPartner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update partner");
      }

      setPartners((prev) =>
        prev.map((p) => (p.id === data.data.id ? data.data : p))
      );
      setActionMessage({ type: "success", text: "Partner updated successfully." });
      closeEdit();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to update partner",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePartner(id: number) {
    if (!confirm("Are you sure you want to delete this partner?")) return;

    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/partner-companies/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete partner");
      }

      setPartners((prev) => prev.filter((p) => p.id !== id));
      setActionMessage({ type: "success", text: "Partner deleted successfully." });
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to delete partner",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDriver(formData: any) {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/com-drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to add driver");
      }

      setActionMessage({ type: "success", text: "Driver added successfully." });
      closeAddDriver();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to add driver",
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
          <h1 className="text-2xl font-bold text-gray-900">Partner Companies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage partner companies for delivery services.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
        >
          <Plus size={16} />
          Add Partner
        </button>
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
              placeholder="Search by name, CVR, or ID..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Partners table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3">CVR</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPartners.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-4 py-3 text-gray-500">#{p.id}</td>
                  <td className="px-4 py-3">{p.cvr || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Building size={16} />
                      </div>
                      <div className="font-medium text-gray-900">{p.comName}</div>
                      <div className="flex items-center gap-1">
                        {p.comStatus ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <AlertTriangle size={16} className="text-orange-500" />
                        )}
                        {p.contractSigned ? (
                          <FileText size={16} className="text-green-500" />
                        ) : (
                          <FileText size={16} className="text-red-500" />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openAddDriver(p.id, p.comName)}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Add Driver"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => alert('Add Car functionality not implemented yet')}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Add Car"
                      >
                        <Car size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Partner"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeletePartner(p.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Partner"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPartners.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Search size={24} className="text-gray-400" />
                      </div>
                      <p>No partners found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Partner Modal */}
      {showAddModal && (
        <PartnerModal
          title="Add New Partner Company"
          onClose={closeAddModal}
          onSave={handleAddPartner}
          loading={loading}
          initialData={{
            cvr: "",
            comName: "",
            contactPerson: "",
            comAddress: "",
            comPhone: "",
            comEmail: "",
            comBankInfo: "",
            comStatus: false,
            commissionRate: 0,
            contractSigned: false,
            comUserName: "",
            comPass: "",
          }}
        />
      )}

      {/* Edit Partner Modal */}
      {editPartner && (
        <PartnerModal
          title="Edit Partner Company"
          onClose={closeEdit}
          onSave={handleUpdatePartner}
          loading={loading}
          initialData={editPartner}
          isEdit={true}
        />
      )}

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <AddDriverModal
          companyId={showAddDriverModal.companyId}
          companyName={showAddDriverModal.companyName}
          onClose={closeAddDriver}
          onSave={handleAddDriver}
          loading={loading}
        />
      )}
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

function PartnerModal({ title, onClose, onSave, loading, initialData, isEdit = false }: ModalProps) {
  const [formData, setFormData] = useState(initialData);
  const [cvrLoading, setCvrLoading] = useState(false);

  async function fetchCVR(cvr: string) {
    setCvrLoading(true);
    try {
      // Generate username and password
      const username = `com${cvr}`;
      const password = `com${cvr}-${cvr}`;

      // Fetch CVR data
      const res = await fetch(`/api/cvr?search=${cvr}`);
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Failed to fetch CVR data');
      const data = result.data;

      // Assuming the API returns an object with company data
      setFormData((prev: any) => ({
        ...prev,
        comName: data.name || prev.comName,
        comAddress: data.address ? `${data.address}, ${data.zipcode} ${data.city}` : prev.comAddress,
        comPhone: data.phone || prev.comPhone,
        comEmail: data.email || prev.comEmail,
        contactPerson: data.owners?.[0]?.name || prev.contactPerson,
        comUserName: username,
        comPass: password,
        // Add other fields if available
      }));
    } catch (error) {
      console.error('CVR fetch error:', error);
      // Optionally show error message
    } finally {
      setCvrLoading(false);
    }
  }

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
                CVR
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.cvr || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // only digits
                  setFormData({ ...formData, cvr: value });
                  if (value.length === 8) {
                    fetchCVR(value);
                  }
                }}
                disabled={cvrLoading}
              />
              {cvrLoading && <p className="text-xs text-blue-600 mt-1">Fetching company data...</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.comName}
                onChange={(e) => setFormData({ ...formData, comName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Contact Person
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Phone
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.comPhone}
                onChange={(e) => setFormData({ ...formData, comPhone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Email (Optional)
            </label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.comEmail || ""}
              onChange={(e) => setFormData({ ...formData, comEmail: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Address
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.comAddress}
              onChange={(e) => setFormData({ ...formData, comAddress: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Bank Info
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.comBankInfo || ""}
              onChange={(e) => setFormData({ ...formData, comBankInfo: e.target.value })}
            />
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
                value={formData.comUserName}
                onChange={(e) => setFormData({ ...formData, comUserName: e.target.value })}
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
                value={formData.comPass || ""}
                onChange={(e) => setFormData({ ...formData, comPass: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Commission Rate
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={formData.comStatus}
                  onChange={(e) => setFormData({ ...formData, comStatus: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Active Status</span>
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={formData.contractSigned}
                  onChange={(e) => setFormData({ ...formData, contractSigned: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Contract Signed</span>
              </label>
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
                {isEdit ? "Update" : "Add"} Partner
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}