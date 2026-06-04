import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';

const severityStyles: Record<string, string> = {
  low: 'bg-gray-50 text-gray-700 border-gray-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200'
};

const severityIcons: Record<string, ReactNode> = {
  low: <Info size={14} />,
  medium: <CheckCircle size={14} />,
  high: <AlertTriangle size={14} />,
  critical: <ShieldAlert size={14} />
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('da-DK', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(value);
}

function summarizeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return '-';

  const value = metadata as Record<string, unknown>;
  const parts = [
    value.action ? `action: ${String(value.action)}` : '',
    value.targetEmail ? `target: ${String(value.targetEmail)}` : '',
    value.targetUserId ? `userId: ${String(value.targetUserId)}` : '',
    value.table ? `table: ${String(value.table)}` : '',
    value.deletedCount !== undefined ? `deleted: ${String(value.deletedCount)}` : '',
    value.previousRole && value.nextRole ? `${String(value.previousRole)} -> ${String(value.nextRole)}` : ''
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(metadata);
}

export default async function AdminAuditPage() {
  await requirePermission('audit.read');

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 200
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">
          Recent administrative and security-sensitive activity.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const severity = String(log.severity || 'low').toLowerCase();
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${severityStyles[severity] || severityStyles.low}`}>
                        {severityIcons[severity] || severityIcons.low}
                        {severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{log.event}</td>
                    <td className="px-4 py-3 text-gray-600">{log.userId || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xl">
                      <span className="line-clamp-2" title={JSON.stringify(log.metadata)}>
                        {summarizeMetadata(log.metadata)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
