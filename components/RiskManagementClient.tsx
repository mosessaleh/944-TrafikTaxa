"use client";
import { useState } from 'react';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  TrendingUp,
  Clock,
  User,
  MapPin,
  DollarSign
} from 'lucide-react';

interface Booking {
  id: number;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  price: number;
  status: string;
  riskScore?: number;
  riskLevel?: string;
  riskFactors?: any[];
  riskReviewed?: boolean;
  riskApproved?: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Stats {
  totalBookings: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  reviewedCount: number;
  escalatedCount: number;
  recentHighRisk: number;
  riskByCategory?: any[];
  topRiskFactors?: any[];
  riskTrends?: any[];
}

interface RiskManagementClientProps {
  initialBookings: Booking[];
  stats: Stats;
}

export default function RiskManagementClient({ initialBookings, stats }: RiskManagementClientProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'unreviewed'>('all');
  const [activeTab, setActiveTab] = useState<'queue' | 'analytics' | 'knowledge'>('queue');

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setModalOpen(true);
  };

  const handleRiskAction = async (bookingId: number, action: 'approve' | 'reject' | 'review') => {
    try {
      const response = await fetch(`/api/admin/risk/${bookingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        // Update local state
        setBookings(bookings.map(b =>
          b.id === bookingId
            ? {
                ...b,
                riskReviewed: true,
                riskApproved: action === 'approve'
              }
            : b
        ));
        alert(`Booking ${action}d successfully!`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update booking');
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
      alert('Failed to update booking. Please try again.');
    }
  };

  const filteredBookings = bookings.filter(booking => {
    switch (filter) {
      case 'high':
        return booking.riskLevel === 'high' || booking.riskLevel === 'critical';
      case 'medium':
        return booking.riskLevel === 'medium';
      case 'unreviewed':
        return !booking.riskReviewed;
      default:
        return true;
    }
  });

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getRiskIcon = (level?: string) => {
    switch (level) {
      case 'critical':
      case 'high': return <AlertTriangle size={14} />;
      case 'medium': return <Clock size={14} />;
      default: return <CheckCircle size={14} />;
    }
  };

  return (
    <>
      {/* Tab Navigation */}
      <div className="border-b border-gray-100">
        <div className="flex">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Risk Assessment Queue
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Analytics Dashboard
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'knowledge'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            قاعدة المعرفة
          </button>
        </div>
      </div>

      {activeTab === 'queue' && (
        <>
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Risk Assessment Queue</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review and manage bookings flagged for risk assessment
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Risks</option>
                  <option value="high">High Risk Only</option>
                  <option value="medium">Medium Risk</option>
                  <option value="unreviewed">Unreviewed</option>
                </select>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.highRiskCount}</div>
                <div className="text-xs text-gray-500">High Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.mediumRiskCount}</div>
                <div className="text-xs text-gray-500">Medium Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.reviewedCount}</div>
                <div className="text-xs text-gray-500">Reviewed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.recentHighRisk}</div>
                <div className="text-xs text-gray-500">Last 7 Days</div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="p-6 border-b border-gray-100">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Risk Analytics Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">
              Comprehensive insights into risk patterns and trends
            </p>
          </div>

          {/* Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Distribution</h3>
              <div className="space-y-2">
                {stats.riskByCategory?.map((category: any) => (
                  <div key={category.level} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{category.level}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{category.count}</span>
                      <span className="text-xs text-gray-500">({Math.round(category.avgScore)} avg)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Risk Factors</h3>
              <div className="space-y-2">
                {stats.topRiskFactors?.slice(0, 5).map((factor: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 truncate flex-1">{factor.description}</span>
                    <span className="text-xs text-gray-500 ml-2">{factor.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Trends */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk Trends (Last 30 Days)</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stats.riskTrends?.map((trend: any) => (
                <div key={trend.date} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-600">
                    {new Date(trend.date).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span>Total: {trend.totalBookings}</span>
                    <span className="text-red-600">High Risk: {trend.highRiskBookings}</span>
                    <span className="text-gray-500">Avg Score: {Math.round(trend.avgRiskScore)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Booking</th>
              <th className="px-6 py-3">Risk Score</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredBookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium">
                      {booking.user.firstName[0]}{booking.user.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {booking.user.firstName} {booking.user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{booking.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">#{booking.id}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-600 max-w-[200px] truncate">
                      <MapPin size={12} />
                      {booking.pickupAddress} → {booking.dropoffAddress}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(booking.riskLevel)}`}>
                      {getRiskIcon(booking.riskLevel)}
                      {booking.riskScore || 0}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(booking.riskLevel)}`}>
                      {getRiskIcon(booking.riskLevel)}
                      {booking.riskLevel || 'low'}
                    </span>
                    {booking.riskReviewed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                        <CheckCircle size={10} />
                        Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        <Clock size={10} />
                        Pending
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {new Date(booking.pickupTime).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleViewBooking(booking)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    {!booking.riskReviewed && (
                      <>
                        <button
                          onClick={() => handleRiskAction(booking.id, 'approve')}
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRiskAction(booking.id, 'reject')}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredBookings.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Shield size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No risk assessments found</h3>
            <p className="text-sm">All bookings are currently low risk or have been reviewed.</p>
          </div>
        )}
        </div>
      )}

      {/* Risk Details Modal */}
      {modalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Risk Assessment Details</h2>

            {/* Booking Info */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Booking Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Booking ID:</strong> #{selectedBooking.id}
                </div>
                <div>
                  <strong>Customer:</strong> {selectedBooking.user.firstName} {selectedBooking.user.lastName}
                </div>
                <div>
                  <strong>Pickup:</strong> {selectedBooking.pickupAddress}
                </div>
                <div>
                  <strong>Dropoff:</strong> {selectedBooking.dropoffAddress}
                </div>
                <div>
                  <strong>Time:</strong> {new Date(selectedBooking.pickupTime).toLocaleString()}
                </div>
                <div>
                  <strong>Price:</strong> {selectedBooking.price} DKK
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Risk Assessment</h3>
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <strong>Risk Score:</strong> {selectedBooking.riskScore || 0}/100
                </div>
                <div>
                  <strong>Risk Level:</strong>
                  <span className={`ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(selectedBooking.riskLevel)}`}>
                    {getRiskIcon(selectedBooking.riskLevel)}
                    {selectedBooking.riskLevel || 'low'}
                  </span>
                </div>
                <div>
                  <strong>Status:</strong>
                  {selectedBooking.riskReviewed ? (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle size={10} />
                      Reviewed
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      <Clock size={10} />
                      Pending Review
                    </span>
                  )}
                </div>
              </div>

              {/* Risk Factors */}
              {selectedBooking.riskFactors && selectedBooking.riskFactors.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Risk Factors:</h4>
                  <div className="space-y-2">
                    {selectedBooking.riskFactors.map((factor: any, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-white rounded border">
                        <AlertTriangle size={14} className={`mt-0.5 flex-shrink-0 ${
                          factor.severity === 'critical' ? 'text-red-500' :
                          factor.severity === 'high' ? 'text-orange-500' :
                          factor.severity === 'medium' ? 'text-yellow-500' : 'text-green-500'
                        }`} />
                        <div>
                          <div className="font-medium text-sm">{factor.description}</div>
                          <div className="text-xs text-gray-500">
                            Type: {factor.type} | Severity: {factor.severity} | Score: +{factor.score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Close
              </button>
              {!selectedBooking.riskReviewed && (
                <>
                  <button
                    onClick={() => {
                      handleRiskAction(selectedBooking.id, 'approve');
                      setModalOpen(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Approve Booking
                  </button>
                  <button
                    onClick={() => {
                      handleRiskAction(selectedBooking.id, 'reject');
                      setModalOpen(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Reject Booking
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}