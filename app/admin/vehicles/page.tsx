"use client";
import { useState } from 'react';
import useSWR from 'swr';
const fetcher=(u:string)=> fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function AdminVehicles(){
  const { data, mutate } = useSWR('/api/admin/vehicle-types',{ fetcher });
  const items = data?.items||[];
  const [showModal, setShowModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    key: '',
    title: '',
    capacity: 4,
    multiplier: 1.0,
    active: true
  });

  async function save(row:any){
    await fetch('/api/admin/vehicle-types',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(row) });
    mutate();
  }

  async function addNew(){
    if (!newVehicle.key.trim() || !newVehicle.title.trim()) {
      alert('Please fill in both Key and Title fields');
      return;
    }

    await fetch('/api/admin/vehicle-types',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newVehicle) });
    mutate();
    setShowModal(false);
    setNewVehicle({ key: '', title: '', capacity: 4, multiplier: 1.0, active: true });
  }

  async function deleteItem(id: number){
    if (!confirm('Are you sure you want to delete this vehicle type?')) return;
    await fetch(`/api/admin/vehicle-types?id=${id}`,{ method:'DELETE' });
    mutate();
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicle Types Management</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          ➕ Add New Vehicle Type
        </button>
      </div>

      {/* Modal for adding new vehicle type */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Vehicle Type</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key (Unique Identifier)</label>
                <input
                  type="text"
                  value={newVehicle.key}
                  onChange={(e) => setNewVehicle({...newVehicle, key: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., SEDAN, SUV, VAN"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (Display Name)</label>
                <input
                  type="text"
                  value={newVehicle.title}
                  onChange={(e) => setNewVehicle({...newVehicle, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Sedan Car, SUV Vehicle"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Passengers)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={newVehicle.capacity}
                  onChange={(e) => setNewVehicle({...newVehicle, capacity: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={newVehicle.multiplier}
                  onChange={(e) => setNewVehicle({...newVehicle, multiplier: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newVehicle.active}
                  onChange={(e) => setNewVehicle({...newVehicle, active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Active (Available for booking)
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addNew}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add Vehicle Type
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">#</th><th className="p-3">Key</th><th className="p-3">Title</th><th className="p-3">Capacity</th><th className="p-3">Multiplier</th><th className="p-3">Active</th><th className="p-3">Actions</th>
          </tr></thead>
          <tbody>
            {items.map((r:any)=> (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.id}</td>
                <td className="p-3"><input defaultValue={r.key} onChange={e=> r.key=e.target.value} className="px-2 py-1 border rounded uppercase"/></td>
                <td className="p-3"><input defaultValue={r.title} onChange={e=> r.title=e.target.value} className="px-2 py-1 border rounded"/></td>
                <td className="p-3"><input type="number" min={1} max={16} defaultValue={r.capacity} onChange={e=> r.capacity=Number(e.target.value)} className="px-2 py-1 border rounded w-24"/></td>
                <td className="p-3"><input type="number" step="0.01" min={0.1} defaultValue={Number(r.multiplier).toFixed(2)} onChange={e=> r.multiplier=Number(e.target.value)} className="px-2 py-1 border rounded w-24"/></td>
                <td className="p-3">
                  <input type="checkbox" defaultChecked={r.active} onChange={e=> r.active=e.target.checked}/>
                </td>
                <td className="p-3 flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors" onClick={()=> save(r)}>💾 Save</button>
                  <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors" onClick={()=> deleteItem(r.id)}>🗑️ Delete</button>
                </td>
              </tr>
            ))}
            {items.length===0 && (<tr><td className="p-4 text-center" colSpan={7}>No vehicle types yet. Click "Add New Vehicle Type" to create one.</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Note: final price = base(day/night) × multiplier. Changes take effect immediately.</p>
    </div>
  );
}
