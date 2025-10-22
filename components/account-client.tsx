"use client";
import { useEffect, useState } from "react";
import AddressAutocomplete, { type Suggestion } from "@/components/address-autocomplete";

type Me = {
  id: number;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
} | null;

type Ride = {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  price: number;
  status: string;
};

type Fav = { id: number; label: string; address: string; lat: number | null; lon: number | null };
type Tab = "profile" | "history" | "favorites";

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-2xl border ${
        active ? "bg-black text-white border-black" : "bg-white text-black"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="text-sm text-gray-700">{label}</div>
      {children}
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl bg-white border shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} aria-label="Close" className="px-2 py-1 text-sm rounded border">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AccountClient() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "profile";
    const u = new URL(window.location.href);
    const t = u.searchParams.get("tab");
    return t === "history" || t === "favorites" ? (t as Tab) : "profile";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    history.replaceState(null, "", u.toString());
  }, [tab]);

  const [me, setMe] = useState<Me>(null);
  const [saving, setSaving] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Add Favorite modal state
  const [addFavOpen, setAddFavOpen] = useState(false);
  const [favLabel, setFavLabel] = useState("");
  const [favAddress, setFavAddress] = useState("");
  const [favSel, setFavSel] = useState<Suggestion | null>(null);

  // load profile
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setMe(j.me);
        } else setMe(null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // load history on tab switch
  useEffect(() => {
    if (tab !== "history") return;
    (async () => {
      try {
        const r = await fetch("/api/bookings", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setRides(j.rides || []);
        }
      } catch {}
    })();
  }, [tab]);

  // load favorites on tab switch
  useEffect(() => {
    if (tab !== "favorites") return;
    (async () => {
      try {
        const r = await fetch("/api/favorites", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setFavs(j.items || []);
        }
      } catch {}
    })();
  }, [tab]);

  async function saveProfile() {
    try {
      if (!me) return;
      setSaving(true);
      setMsg(null);
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(me),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Save failed");
      setMsg("Profile saved");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateFav(row: Fav) {
    const r = await fetch("/api/favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const j = await r.json();
    if (j?.ok) setFavs((prev) => prev.map((x) => (x.id === row.id ? j.item : x)));
  }
  async function deleteFav(id: number) {
    const r = await fetch(`/api/favorites?id=${id}`, { method: "DELETE" });
    const j = await r.json();
    if (j?.ok) setFavs((prev) => prev.filter((x) => x.id !== id));
  }
  async function createFav() {
    try {
      const address = (favSel?.text || favAddress).trim();
      const label = favLabel.trim() || "Favorite";
      if (!address) return;
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          address,
          lat: favSel?.lat ?? null,
          lon: favSel?.lon ?? null,
        }),
      });
      const j = await res.json();
      if (j?.ok) {
        setFavs((prev) => [j.item, ...prev]);
        setAddFavOpen(false);
        setFavLabel("");
        setFavAddress("");
        setFavSel(null);
      }
    } catch {}
  }

  if (me === null) {
    return <div className="max-w-5xl mx-auto p-4">Loading…</div>;
  }
  if (!me) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="p-3 rounded-xl border bg-yellow-50">Please login to view your account.</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 grid gap-6">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="flex gap-2">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          Profile
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
        <TabButton active={tab === "favorites"} onClick={() => setTab("favorites")}>
          Favorites
        </TabButton>
      </div>

      {tab === "profile" && (
        <div className="grid gap-4 bg-white border rounded-2xl p-4">
          {!me.emailVerified && (
            <div className="p-2 rounded-lg text-sm bg-orange-50 text-orange-900 border">
              Your email is not verified.
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="First name">
              <input
                value={me.firstName}
                onChange={(e) => setMe({ ...me!, firstName: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="Last name">
              <input
                value={me.lastName}
                onChange={(e) => setMe({ ...me!, lastName: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="Email">
              <input
                value={me.email}
                onChange={(e) => setMe({ ...me!, email: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="Phone">
              <input
                value={me.phone}
                onChange={(e) => setMe({ ...me!, phone: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="Street">
              <input
                value={me.street}
                onChange={(e) => setMe({ ...me!, street: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="House no.">
              <input
                value={me.houseNumber}
                onChange={(e) => setMe({ ...me!, houseNumber: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="Postal code">
              <input
                value={me.postalCode}
                onChange={(e) => setMe({ ...me!, postalCode: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
            <Field label="City">
              <input
                value={me.city}
                onChange={(e) => setMe({ ...me!, city: e.target.value })}
                className="px-3 py-2 rounded-xl border bg-white"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={saving}
              onClick={saveProfile}
              className={`px-4 py-2 rounded-2xl ${
                saving ? "bg-gray-300 text-gray-600" : "bg-black text-white"
              }`}
            >
              Save
            </button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="grid gap-3">
          <div>
            <a href="/book" className="inline-block px-4 py-2 rounded-2xl bg-black text-white">
              Book a new ride
            </a>
          </div>
          <div className="bg-white border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Pickup</th>
                  <th className="p-3">Dropoff</th>
                  <th className="p-3">Time</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.id}</td>
                    <td className="p-3">{r.pickupAddress}</td>
                    <td className="p-3">{r.dropoffAddress}</td>
                    <td className="p-3">{new Date(r.pickupTime).toLocaleString()}</td>
                    <td className="p-3">{r.price} DKK</td>
                    <td className="p-3 uppercase text-xs">{r.status}</td>
                  </tr>
                ))}
                {rides.length === 0 && (
                  <tr>
                    <td className="p-4" colSpan={6}>
                      No rides yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "favorites" && (
        <div className="grid gap-3">
          <div>
            <button
              onClick={() => {
                setAddFavOpen(true);
                setFavLabel("");
                setFavAddress("");
                setFavSel(null);
              }}
              className="px-4 py-2 rounded-2xl border"
            >
              Add favorite
            </button>
          </div>
          <div className="bg-white border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3">Label</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {favs.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-3">
                      <input
                        defaultValue={f.label}
                        onChange={(e) => (f.label = e.target.value)}
                        className="px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        defaultValue={f.address}
                        onChange={(e) => (f.address = e.target.value)}
                        className="px-2 py-1 border rounded w-[30rem] max-w-full"
                      />
                    </td>
                    <td className="p-3 flex gap-2">
                      <button className="px-3 py-1 rounded border" onClick={() => updateFav(f)}>
                        Save
                      </button>
                      <button className="px-3 py-1 rounded border" onClick={() => deleteFav(f.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {favs.length === 0 && (
                  <tr>
                    <td className="p-4" colSpan={3}>
                      No favorites yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Modal open={addFavOpen} onClose={() => setAddFavOpen(false)} title="Add favorite">
            <div className="grid gap-3">
              <Field label="Label">
                <input
                  value={favLabel}
                  onChange={(e) => setFavLabel(e.target.value)}
                  placeholder="e.g. Home, Work"
                  className="px-3 py-2 rounded-xl border bg-white"
                />
              </Field>
              <div className="grid gap-1">
                <div className="text-sm text-gray-700">Address</div>
                <AddressAutocomplete
                  label=" "
                  name="favAddress"
                  value={favSel ? favSel.text : favAddress}
                  onChange={(v) => {
                    setFavAddress(v);
                    setFavSel(null);
                  }}
                  onSelect={(s) => {
                    setFavSel(s);
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setAddFavOpen(false)} className="px-3 py-2 rounded-xl border">
                  Cancel
                </button>
                <button onClick={createFav} className="px-3 py-2 rounded-xl bg-black text-white">
                  Save
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
