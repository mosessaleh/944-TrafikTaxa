"use client";
import { useState } from 'react';
import useSWR from 'swr';
import { 
  Car, 
  Plus, 
  Save, 
  Trash2, 
  Info,
  CheckCircle,
  XCircle,
  Edit2
} from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicle Types</h1>
            <p className="text-gray-500 text-sm mt-1">Manage vehicle types, pricing multipliers, and availability.</p>
        </div>
        <button 
            onClick={() => setShowModal(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Vehicle Type
        </button>
      </div>

      {/* Modal for adding new vehicle type */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">Add New Vehicle Type</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Key (Unique Identifier)</label>
                <input
                  type="text"
                  value={newVehicle.key}
                  onChange={(e) => setNewVehicle({...newVehicle, key: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  placeholder="e.g., SEDAN, SUV, VAN"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Title (Display Name)</label>
                <input
                  type="text"
                  value={newVehicle.title}
                  onChange={(e) => setNewVehicle({...newVehicle, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Sedan Car, SUV Vehicle"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
                    <input
                    type="number"
                    min="1"
                    max="16"
                    value={newVehicle.capacity}
                    onChange={(e) => setNewVehicle({...newVehicle, capacity: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Multiplier</label>
                    <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={newVehicle.multiplier}
                    onChange={(e) => setNewVehicle({...newVehicle, multiplier: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={newVehicle.active}
                        onChange={(e) => setNewVehicle({...newVehicle, active: e.target.checked})}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">Active (Available for booking)</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={addNew}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
              >
                Add Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                    <th className="px-4 py-3 w-16">ID</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3 w-24">Capacity</th>
                    <th className="px-4 py-3 w-24">Multiplier</th>
                    <th className="px-4 py-3 w-24">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {items.map((r:any)=> (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3 text-gray-500">#{r.id}</td>
                    <td className="px-4 py-3">
                        <input 
                            defaultValue={r.key} 
                            onChange={e=> r.key=e.target.value} 
                            className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-900 uppercase focus:ring-0"
                        />
                    </td>
                    <td className="px-4 py-3">
                        <input 
                            defaultValue={r.title} 
                            onChange={e=> r.title=e.target.value} 
                            className="w-full bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0"
                        />
                    </td>
                    <td className="px-4 py-3">
                        <input 
                            type="number" 
                            min={1} 
                            max={16} 
                            defaultValue={r.capacity} 
                            onChange={e=> r.capacity=Number(e.target.value)} 
                            className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
                        />
                    </td>
                    <td className="px-4 py-3">
                        <input 
                            type="number" 
                            step="0.01" 
                            min={0.1} 
                            defaultValue={Number(r.multiplier).toFixed(2)} 
                            onChange={e=> r.multiplier=Number(e.target.value)} 
                            className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
                        />
                    </td>
                    <td className="px-4 py-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                defaultChecked={r.active} 
                                onChange={e=> r.active=e.target.checked} 
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={()=> save(r)}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Save Changes"
                            >
                                <Save size={16} />
                            </button>
                            <button 
                                onClick={()=> deleteItem(r.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Vehicle"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
                {items.length===0 && (
                    <tr>
                        <td className="px-4 py-12 text-center text-gray-500" colSpan={7}>
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <Car size={24} className="text-gray-400" />
                                </div>
                                <p>No vehicle types found.</p>
                                <button onClick={() => setShowModal(true)} className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                                    Add your first vehicle type
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 items-start">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Pricing Calculation</p>
            <p>Final Price = Base Price (Day/Night) × Distance × Vehicle Multiplier.</p>
            <p className="mt-1 text-blue-600">Changes made to vehicle types take effect immediately for new bookings.</p>
        </div>
      </div>
    </div>
  );
}
