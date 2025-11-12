'use client';

import { useState, useEffect } from 'react';

interface TableCount {
  name: string;
  count: number;
}

export default function ClearDataClient() {
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  useEffect(() => {
    fetchTableCounts();
  }, []);

  const fetchTableCounts = async () => {
    try {
      const response = await fetch('/api/admin/clear-data');
      if (response.ok) {
        const data = await response.json();
        setTableCounts(data.tables || []);
      }
    } catch (error) {
      console.error('Error fetching table counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async (table: string) => {
    let warningMessage = `Are you absolutely sure you want to clear ALL data from the "${table}" table? This action cannot be undone!`;
    
    // Add cascade warning for rides
    if (table === 'ride') {
      warningMessage += '\n\nWARNING: This will also delete all related complaints and invoices!';
    }

    if (!confirm(warningMessage)) {
      return;
    }

    const confirmation = prompt(`Type "CLEAR ${table.toUpperCase()}" to confirm:`);
    if (confirmation !== `CLEAR ${table.toUpperCase()}`) {
      alert('Confirmation failed. Action cancelled.');
      return;
    }

    setClearing(table);
    try {
      const response = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully cleared ${result.deletedCount} records from "${table}" table!`);
        await fetchTableCounts(); // Refresh counts
      } else {
        const error = await response.json();
        alert(`Failed to clear data: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please check the console for details.');
    } finally {
      setClearing(null);
    }
  };

  const getTableDisplayName = (table: string) => {
    const names: { [key: string]: string } = {
      'ride': 'Bookings/Rides',
      'invoice': 'Invoices',
      'complaint': 'Complaints',
      'favoriteAddress': 'Favorite Addresses',
      'paymentMethod': 'Payment Methods',
      'cryptoPayment': 'Crypto Payments',
      'cardPayment': 'Card Payments',
      'paypalPayment': 'PayPal Payments',
      'revolutPayment': 'Revolut Payments',
      'cryptoWallet': 'Crypto Wallets',
      'auditLog': 'Audit Logs'
    };
    return names[table] || table;
  };

  const getTableIcon = (table: string) => {
    const icons: { [key: string]: string } = {
      'ride': '🚗',
      'invoice': '🧾',
      'complaint': '📝',
      'favoriteAddress': '⭐',
      'paymentMethod': '💳',
      'cryptoPayment': '₿',
      'cardPayment': '💳',
      'paypalPayment': '🅿️',
      'revolutPayment': '🔄',
      'cryptoWallet': '💰',
      'auditLog': '📋'
    };
    return icons[table] || '📊';
  };

  const excludedTables = ['user', 'vehicleType', 'settings', '_prisma_migrations'];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🧹 Clear Database Data</h1>
        <p className="text-gray-600 mt-2">
          Select a table to clear all its data. This action is irreversible!
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <div className="text-red-600 text-xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800">Danger Zone</h3>
              <p className="text-red-700 text-sm mt-1">
                Clearing data will permanently delete all records from the selected table. 
                The table will be reset and IDs will start from 1 again.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clearable Tables */}
      <div className="grid gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Available Tables to Clear</h2>
        <div className="grid gap-3">
          {tableCounts.map((tableData) => (
            <div key={tableData.name} className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{getTableIcon(tableData.name)}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getTableDisplayName(tableData.name)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Current records: <span className="font-mono font-semibold">{tableData.count}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleClearData(tableData.name)}
                  disabled={clearing === tableData.name || tableData.count === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearing === tableData.name ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Clearing...
                    </div>
                  ) : (
                    'Clear Data'
                  )}
                </button>
              </div>
              {tableData.count === 0 && (
                <div className="mt-3 text-sm text-gray-500">
                  This table is already empty.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Excluded Tables */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Protected Tables (Cannot be cleared)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {excludedTables.map((table) => (
            <div key={table} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-gray-400">🔒</span>
              <span className="font-mono">{table}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-3">
          These tables are protected because they contain essential system data.
        </p>
      </div>
    </div>
  );
}