"use client";

import { useMemo, useState } from "react";
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Edit2, 
  Send,
  MoreVertical,
  Filter,
  Users
} from 'lucide-react';

export type AdminUserRole = "USER" | "ADMIN";

export type AdminUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: AdminUserRole;
  emailVerified: boolean;
  canPayByInvoice?: boolean | null;
  createdAt?: string | null;
};

type Props = {
  initialUsers: AdminUser[];
};

type SearchField = "id" | "name" | "email" | "phone";

type ActionMessage = { type: "success" | "error"; text: string } | null;

export default function AdminUsersClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("name");

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [emailUser, setEmailUser] = useState<AdminUser | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const verifiedCount = users.filter((u) => u.emailVerified).length;

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;

    return users.filter((u) => {
      switch (searchField) {
        case "id":
          return String(u.id).includes(term);
        case "name":
          return `${u.firstName || ""} ${u.lastName || ""}`
            .toLowerCase()
            .includes(term);
        case "email":
          return (u.email || "").toLowerCase().includes(term);
        case "phone":
          return (u.phone || "").toLowerCase().includes(term);
        default:
          return true;
      }
    });
  }, [users, searchField, searchTerm]);

  function formatDate(value?: string | null) {
    if (!value) return "-";
    try {
      // Use consistent date formatting to avoid hydration mismatches
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "-";
    }
  }

  function openEdit(user: AdminUser) {
    setActionMessage(null);
    setEditUser({ ...user });
  }

  function closeEdit() {
    setEditUser(null);
  }

  function openEmail(user: AdminUser) {
    setActionMessage(null);
    setEmailUser(user);
    setEmailSubject(`Message from 944 Trafik`);
    setEmailBody("");
  }

  function closeEmail() {
    setEmailUser(null);
    setEmailSubject("");
    setEmailBody("");
  }

  async function handleSaveUser() {
    if (!editUser) return;
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUser.id,
          firstName: editUser.firstName,
          lastName: editUser.lastName,
          phone: editUser.phone,
          address: editUser.address,
          role: editUser.role,
          emailVerified: editUser.emailVerified,
          canPayByInvoice: editUser.canPayByInvoice ?? false,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        throw new Error(data.error || "Failed to update user");
      }

      const updated: AdminUser = data.user;
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      );
      setActionMessage({ type: "success", text: "User updated successfully." });
      setEditUser(null);
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to update user",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!emailUser) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      setActionMessage({
        type: "error",
        text: "Subject and message body are required.",
      });
      return;
    }
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/users/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: emailUser.id,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }
      setActionMessage({ type: "success", text: "Email sent successfully." });
      closeEmail();
    } catch (e: any) {
      setActionMessage({
        type: "error",
        text: e?.message || "Failed to send email",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search and manage users, view details, and contact them directly.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={totalUsers} icon={<Users size={20} />} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Verified Users" value={verifiedCount} icon={<CheckCircle size={20} />} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Administrators" value={adminCount} icon={<Shield size={20} />} color="text-purple-600" bg="bg-purple-50" />
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
        
        {/* Search & Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer w-full"
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value as SearchField)}
                    >
                        <option value="name">Name</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="id">ID</option>
                    </select>
                </div>
            </div>

            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder={`Search by ${searchField}...`}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* Users table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" suppressHydrationWarning>
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-4 py-3 text-gray-500">#{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-sm">
                        {u.firstName?.charAt(0).toUpperCase()}{u.lastName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-gray-500" suppressHydrationWarning>Joined {formatDate(u.createdAt)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-gray-600">
                            <Mail size={14} className="text-gray-400" />
                            <span className="truncate max-w-[180px]">{u.email}</span>
                        </div>
                        {u.phone && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                                <Phone size={14} className="text-gray-400" />
                                <span>{u.phone}</span>
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        u.role === 'ADMIN' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                        : 'bg-gray-50 text-gray-700 border-gray-100'
                    }`}>
                        {u.role === 'ADMIN' && <Shield size={12} className="mr-1" />}
                        {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle size={12} /> Verified
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500 text-xs font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                            Unverified
                        </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => openEmail(u)}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Send Email"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <Search size={24} className="text-gray-400" />
                        </div>
                        <p>No users found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit User
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Email Address
                </label>
                <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium">
                  {editUser.email}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    First Name
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editUser.firstName}
                    onChange={(e) =>
                      setEditUser({ ...editUser, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Last Name
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editUser.lastName}
                    onChange={(e) =>
                      setEditUser({ ...editUser, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Phone
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editUser.phone || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Address
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editUser.address || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, address: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Role
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={editUser.role}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        role: e.target.value as AdminUserRole,
                      })
                    }
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                
                <div className="flex flex-col justify-end gap-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={editUser.emailVerified}
                            onChange={(e) =>
                                setEditUser({
                                ...editUser,
                                emailVerified: e.target.checked,
                                })
                            }
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">Email Verified</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={!!editUser.canPayByInvoice}
                            onChange={(e) =>
                                setEditUser({
                                ...editUser,
                                canPayByInvoice: e.target.checked,
                                })
                            }
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">Can Pay by Invoice</span>
                    </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send email modal */}
      {emailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail size={18} className="text-gray-500" />
                Email to {emailUser.firstName}
              </h2>
              <button
                type="button"
                onClick={closeEmail}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                <Shield size={14} className="shrink-0 mt-0.5" />
                Emails are sent with the official 944 Trafik branding, logo, and signature automatically applied.
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Recipient
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    {emailUser.email}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Subject
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Enter email subject..."
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Message Body
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[200px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your message here..."
                />
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle size={12} />
                  Supports basic HTML tags (p, strong, ul, li, etc.)
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={closeEmail}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading}
              >
                {loading ? "Sending..." : (
                    <>
                        <Send size={16} />
                        Send Email
                    </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
            </div>
        </div>
    )
}
