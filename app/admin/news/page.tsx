"use client";

import { useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { Bell, Calendar, Edit2, Eye, EyeOff, Newspaper, Plus, Save, Trash2, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

type NewsStatus = 'ACTIVE' | 'ENDED';

type NewsItem = {
  id: number;
  slug: string;
  title: string;
  body: string;
  publishedAt: string;
  status: NewsStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  id: undefined as number | undefined,
  title: '',
  body: '',
  publishedAt: new Date().toISOString().slice(0, 16),
  status: 'ACTIVE' as NewsStatus,
  sortOrder: 0,
};

export default function AdminNewsPage() {
  const { data, mutate } = useSWR('/api/admin/news', fetcher);
  const items = (data?.items || []) as NewsItem[];
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'ended'>('all');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filteredItems = useMemo(() => {
    if (activeTab === 'active') return items.filter((item) => item.status === 'ACTIVE');
    if (activeTab === 'ended') return items.filter((item) => item.status === 'ENDED');
    return items;
  }, [activeTab, items]);

  const stats = useMemo(() => ({
    all: items.length,
    active: items.filter((item) => item.status === 'ACTIVE').length,
    ended: items.filter((item) => item.status === 'ENDED').length,
  }), [items]);

  function openCreate() {
    setForm({
      ...emptyForm,
      publishedAt: new Date().toISOString().slice(0, 16),
    });
    setShowModal(true);
  }

  function openEdit(item: NewsItem) {
    setForm({
      id: item.id,
      title: item.title,
      body: item.body,
      publishedAt: item.publishedAt.slice(0, 16),
      status: item.status,
      sortOrder: item.sortOrder,
    });
    setShowModal(true);
  }

  async function saveNews() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sortOrder: Number(form.sortOrder || 0),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to save company news');
      }

      setShowModal(false);
      setForm(emptyForm);
      mutate();
    } catch (error: any) {
      alert(error?.message || 'Failed to save company news');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeNews(id: number) {
    if (!confirm('Are you sure you want to delete this news item?')) return;

    const response = await fetch(`/api/admin/news?id=${id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      alert(payload?.error || 'Failed to delete company news');
      return;
    }

    mutate();
  }

  async function toggleStatus(item: NewsItem) {
    await fetch('/api/admin/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        title: item.title,
        body: item.body,
        publishedAt: item.publishedAt,
        sortOrder: item.sortOrder,
        status: item.status === 'ACTIVE' ? 'ENDED' : 'ACTIVE',
      }),
    });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company News</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the news shown in the customer app homepage.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add News
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NewsStatCard icon={<Newspaper size={18} />} label="All News" value={stats.all} tint="bg-blue-50 text-blue-700" />
        <NewsStatCard icon={<Eye size={18} />} label="Active News" value={stats.active} tint="bg-emerald-50 text-emerald-700" />
        <NewsStatCard icon={<EyeOff size={18} />} label="Ended News" value={stats.ended} tint="bg-amber-50 text-amber-700" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/60">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              <TabButton active={activeTab === 'all'} label={`All (${stats.all})`} onClick={() => setActiveTab('all')} />
              <TabButton active={activeTab === 'active'} label={`Active (${stats.active})`} onClick={() => setActiveTab('active')} />
              <TabButton active={activeTab === 'ended'} label={`Ended (${stats.ended})`} onClick={() => setActiveTab('ended')} />
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-5 hover:bg-gray-50/60 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.status === 'ACTIVE' ? 'Active now' : 'Ended'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={13} />
                      {new Date(item.publishedAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">Sort: {item.sortOrder}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
                  <p className="text-sm text-gray-600 leading-6 whitespace-pre-wrap">{item.body}</p>
                  <div className="text-xs text-gray-400">Slug: {item.slug}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(item)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title={item.status === 'ACTIVE' ? 'Mark as ended' : 'Mark as active'}
                  >
                    {item.status === 'ACTIVE' ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Edit news"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => removeNews(item.id)}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    title="Delete news"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Bell size={20} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No news found</h3>
              <p className="text-sm text-gray-500 mt-1">Create the first company news item to show it in the customer app.</p>
            </div>
          ) : null}
        </div>
      </div>

      {showModal ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Edit company news' : 'Add company news'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">News Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the news title"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">News Text</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="Write the full news text here"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Published Date</label>
                  <input
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, publishedAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as NewsStatus }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ENDED">Ended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/60">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveNews}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save News'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NewsStatCard({ icon, label, value, tint }: { icon: ReactNode; label: string; value: number; tint: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}>{icon}</div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
