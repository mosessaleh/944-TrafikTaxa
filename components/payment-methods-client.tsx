"use client";
import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Stripe Elements appearance
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: true,
};

// Card form component
function CardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create setup intent
      const setupResponse = await fetch('/api/user/payment-methods/setup-intent', {
        method: 'POST',
        credentials: 'include'
      });

      const setupData = await setupResponse.json();

      if (!setupData.success) {
        throw new Error(setupData.error || 'Failed to create setup intent');
      }

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm the setup intent
      const { error: confirmError } = await stripe.confirmCardSetup(setupData.clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Failed to save card');
      }

      // Confirm the setup and save payment method to database
      const confirmResponse = await fetch('/api/user/payment-methods/confirm-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          setupIntentId: setupData.setupIntentId,
          isDefault: false // Could be made configurable later
        })
      });

      const confirmData = await confirmResponse.json();

      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Failed to save payment method');
      }

      // Success - refresh the payment methods list
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Card Information
        </label>
        <div className="p-3 border border-gray-300 rounded-lg bg-white">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding Card...' : 'Add Card'}
        </button>
      </div>
    </form>
  );
}

type PaymentMethod = {
  id: number;
  type: string;
  provider: string;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: string;
};

export default function PaymentMethodsClient() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load payment methods
  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/user/payment-methods', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setPaymentMethods(data.paymentMethods);
      } else {
        setError(data.error || 'Failed to load payment methods');
      }
    } catch (err) {
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  // Add new card
  const handleAddCard = () => {
    setShowAddCard(true);
    setError('');
    setMessage('');
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    setMessage('Payment method added successfully!');
    loadPaymentMethods();
  };

  const handleCancelAdd = () => {
    setShowAddCard(false);
  };

  // Set as default
  const handleSetDefault = async (id: number) => {
    try {
      const response = await fetch(`/api/user/payment-methods/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isDefault: true })
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Default payment method updated');
        loadPaymentMethods();
      } else {
        setError(data.error || 'Failed to update default payment method');
      }
    } catch (err) {
      setError('Failed to update default payment method');
    }
  };

  // Delete payment method
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/payment-methods/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Payment method deleted successfully');
        loadPaymentMethods();
      } else {
        setError(data.error || 'Failed to delete payment method');
      }
    } catch (err) {
      setError('Failed to delete payment method');
    }
  };

  if (loading) {
    return (
      <section className="grid gap-4 bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Payment Methods</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 bg-white border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Payment Methods</h2>
          <button
            onClick={handleAddCard}
            className="px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800"
          >
            + Add Card
          </button>
        </div>

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💳</div>
              <p>No payment methods saved yet.</p>
              <p className="text-sm">Add a card to enable post-trip payments.</p>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">💳</div>
                  <div>
                    <div className="font-medium">
                      •••• •••• •••• {method.last4}
                      {method.isDefault && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Expires {method.expiryMonth?.toString().padStart(2, '0')}/{method.expiryYear}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-medium text-blue-900 mb-2">About Post-Trip Payments</h3>
          <p className="text-sm text-blue-800">
            Your saved payment methods will be used to automatically charge for completed rides.
            Payment is collected only after your trip is successfully completed, ensuring a secure and convenient experience.
          </p>
        </div>
      </section>

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add Payment Method</h3>
            <Elements stripe={stripePromise}>
              <CardForm onSuccess={handleCardAdded} onCancel={handleCancelAdd} />
            </Elements>
          </div>
        </div>
      )}
    </>
  );
}