'use client';

import { useState, useEffect } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  Database, 
  RefreshCw, 
  Shield, 
  CheckCircle,
  AlertOctagon
} from 'lucide-react';

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

  const handleTruncateTransactionTables = async () => {
    const warningMessage = `Are you absolutely sure you want to TRUNCATE ALL transaction tables? This will permanently delete ALL data from: auditlog, cardpayment, cryptopayment, invoice, notification, notificationsettings, ride. IDs will reset to 1. This action cannot be undone!`;

    if (!confirm(warningMessage)) {
      return;
    }

    const confirmation = prompt(`Type "TRUNCATE ALL TRANSACTION TABLES" to confirm:`);
    if (confirmation !== 'TRUNCATE ALL TRANSACTION TABLES') {
      alert('Confirmation failed. Action cancelled.');
      return;
    }

    setClearing('transaction-tables');
    try {
      const response = await fetch('/api/admin/truncate-transaction-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Transaction tables truncated successfully!');
        await fetchTableCounts(); // Refresh counts
      } else {
        const error = await response.json();
        alert(`Failed to truncate tables: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error truncating tables:', error);
      alert('Failed to truncate tables. Please check the console for details.');
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

  const excludedTables = ['user', 'vehicleType', 'settings', '_prisma_migrations'];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
        <div className="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
            <AlertOctagon size={24} />
        </div>
        <div>
            <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
            <p className="text-red-700 text-sm mt-1 leading-relaxed">
            Clearing data will permanently delete all records from the selected table. 
            The table will be reset and IDs will start from 1 again. This action cannot be undone.
            </p>
        </div>
      </div>

      {/* Truncate Transaction Tables */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertOctagon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">Truncate Transaction Tables</h3>
              <p className="text-red-700 text-sm mt-1">
                Reset all transaction-related tables: auditlog, cardpayment, cryptopayment, invoice, notification, notificationsettings, ride.
                IDs will restart from 1.
              </p>
            </div>
          </div>
          <button
            onClick={handleTruncateTransactionTables}
            disabled={clearing === 'transaction-tables'}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
          >
            {clearing === 'transaction-tables' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Truncating...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Truncate All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clearable Tables */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Database size={18} className="text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Manage Database Tables</h2>
            </div>
            <button 
                onClick={fetchTableCounts} 
                className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                title="Refresh Counts"
            >
                <RefreshCw size={18} />
            </button>
        </div>
        
        <div className="divide-y divide-gray-100">
          {tableCounts.map((tableData) => (
            <div key={tableData.name} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    <Database size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {getTableDisplayName(tableData.name)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        {tableData.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      • {tableData.count} records
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleClearData(tableData.name)}
                disabled={clearing === tableData.name || tableData.count === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    tableData.count === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-sm'
                }`}
              >
                {clearing === tableData.name ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Clear Data
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Excluded Tables */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Protected System Tables</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {excludedTables.map((table) => (
            <div key={table} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-green-500">
                <CheckCircle size={16} />
              </div>
              <span className="text-sm font-mono text-gray-600">{table}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            These tables contain essential system configuration and user data that cannot be cleared via this tool.
        </p>
      </div>
    </div>
  );
}