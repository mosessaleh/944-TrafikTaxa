"use client";

import { useMemo, useState } from "react";

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
      return new Date(value).toLocaleDateString();
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search and manage users, view details, and contact them directly.
          </p>
        </div>
        <div className="hidden sm:flex gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
            <div className="text-slate-500">Total</div>
            <div className="font-semibold text-slate-900">{totalUsers}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs">
            <div className="text-emerald-600">Verified</div>
            <div className="font-semibold text-emerald-700">{verifiedCount}</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs">
            <div className="text-indigo-600">Admins</div>
            <div className="font-semibold text-indigo-700">{adminCount}</div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search by
          </label>
          <select
            className="border border-slate-300 rounded-md px-3 py-1.5 text-xs"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as SearchField)}
          >
            <option value="id">ID</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Type to search by selected field..."
            className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-500 mt-5">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {actionMessage && (
        <div
          className={
            actionMessage.type === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800"
          }
        >
          {actionMessage.text}
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Tools</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors"
              >
                <td className="px-4 py-3 text-xs text-slate-500">#{u.id}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                        {u.firstName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-800">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openEmail(u)}
                      className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-black"
                    >
                      Send Email
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Edit User #{editUser.id}
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email
                </label>
                <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                  {editUser.email}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    First name
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                    value={editUser.firstName}
                    onChange={(e) =>
                      setEditUser({ ...editUser, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Last name
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                    value={editUser.lastName}
                    onChange={(e) =>
                      setEditUser({ ...editUser, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Phone
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                    value={editUser.phone || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Address
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                    value={editUser.address || ""}
                    onChange={(e) =>
                      setEditUser({ ...editUser, address: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Role
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                    value={editUser.role}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        role: e.target.value as AdminUserRole,
                      })
                    }
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <label className="text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={editUser.emailVerified}
                      onChange={(e) =>
                        setEditUser({
                          ...editUser,
                          emailVerified: e.target.checked,
                        })
                      }
                    />
                    Email verified
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <label className="text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={!!editUser.canPayByInvoice}
                      onChange={(e) =>
                        setEditUser({
                          ...editUser,
                          canPayByInvoice: e.target.checked,
                        })
                      }
                    />
                    Can pay by invoice
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Created at
                  </label>
                  <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                    {formatDate(editUser.createdAt)}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-50 hover:bg-black disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send email modal */}
      {emailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Send Email to {emailUser.firstName} {emailUser.lastName}
              </h2>
              <button
                type="button"
                onClick={closeEmail}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm overflow-y-auto">
              <div className="text-xs text-slate-500">
                Emails are sent with the 944 Trafik branded template and
                signature, including logo and contact information.
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    To
                  </label>
                  <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                    {emailUser.email}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Subject
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Message
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[160px] font-mono"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your message to the customer here..."
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  You can use basic HTML (e.g. {"<p>"}, {"<strong>"}, {"<ul>"}, {"<li>"}).
                  A professional 944 Trafik header and footer will be automatically added.
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEmail}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-50 hover:bg-black disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
