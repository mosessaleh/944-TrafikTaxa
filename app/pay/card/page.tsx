"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialize Stripe - fallback to mock in development
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  (process.env.NODE_ENV === 'development' ? "pk_test_mock" : "pk_test_placeholder")
);

function CardPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount_dkk");
  const bookingId = searchParams.get("booking_id");

  const [clientSecret, setClientSecret] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [stripe, setStripe] = useState<any>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    console.log("CardPayment: Initializing payment", { amount, bookingId });

    if (!amount) {
      console.error("CardPayment: No amount specified");
      setError("No amount specified");
      setLoading(false);
      return;
    }

    const initializePayment = async () => {
      try {
        console.log("CardPayment: Checking user profile for admin status");

        // Check if user is admin (developer mode)
        const profileResponse = await fetch("/api/profile", {
          credentials: "include",
        });
        const profileData = await profileResponse.json();
        const userIsAdmin = profileData?.me?.role === 'ADMIN';
        console.log("CardPayment: User admin status", { userIsAdmin });
        setIsAdmin(userIsAdmin);

        // For admin users, use mock payments
        if (userIsAdmin) {
          console.log("CardPayment: Using mock payment for admin user");
          setClientSecret(`pi_mock_${Date.now()}_secret_admin`);
          setPaymentIntentId(`pi_mock_${Date.now()}`);
          setLoading(false);
          return;
        }

        console.log("CardPayment: Initializing Stripe for regular user");

        // For regular users, use real Stripe payments
        console.log("CardPayment: Waiting for Stripe to load...");
        const stripeInstance = await stripePromise;
        if (!stripeInstance) {
          console.error("CardPayment: Stripe failed to initialize");
          throw new Error("Stripe failed to initialize");
        }
        console.log("CardPayment: Stripe initialized successfully");
        setStripe(stripeInstance);

        console.log("CardPayment: Creating payment intent", { amountDkk: parseFloat(amount), bookingId });

        // Create payment intent
        console.log("CardPayment: Creating payment intent", { amountDkk: parseFloat(amount), bookingId });
        const response = await fetch("/api/payments/card/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amountDkk: parseFloat(amount),
            bookingId: bookingId,
          }),
        });

        const data = await response.json();
        console.log("CardPayment: Payment intent creation response", { ok: response.ok, data });

        if (!response.ok || !data.ok) {
          console.error("CardPayment: Failed to create payment intent", { error: data.error });
          throw new Error(data.error || "Failed to create payment intent");
        }

        console.log("CardPayment: Payment intent created successfully", { paymentIntentId: data.paymentIntentId });
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      } catch (err: any) {
        console.error("CardPayment: Payment initialization failed", err);
        setError(err.message || "Payment initialization failed");
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [amount]);

  const handlePayment = async (isRetry = false) => {
    console.log("CardPayment: handlePayment called", {
      clientSecret: clientSecret?.substring(0, 20) + "...",
      paymentIntentId,
      bookingId,
      isRetry,
      retryCount
    });

    if (!clientSecret) {
      console.error("CardPayment: No clientSecret available");
      return;
    }

    setLoading(true);
    setError("");
    setLastError("");

    if (isRetry) {
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
    }

    try {
      // Check if this is a mock payment
      if (clientSecret.startsWith('pi_mock_')) {
        console.log("CardPayment: Processing mock payment");

        // Confirm mock payment immediately
        try {
          const confirmResponse = await fetch('/api/payments/card/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ paymentIntentId: paymentIntentId })
          });

          if (confirmResponse.ok) {
            console.log("CardPayment: Mock payment confirmed, redirecting");
            router.push(`/pay/card/success?mock=true&booking_id=${bookingId}`);
          } else {
            throw new Error('Mock payment confirmation failed');
          }
        } catch (err) {
          console.error("CardPayment: Mock payment confirmation failed", err);
          setError("Mock payment failed");
          setLastError("Mock payment failed");
          setLoading(false);
          setIsRetrying(false);
        }
        return;
      }

      console.log("CardPayment: Processing real Stripe payment, redirecting to success page");
      // Real Stripe payment - redirect to success page with payment intent ID and booking ID
      router.push(`/pay/card/success?payment_intent=${paymentIntentId}&booking_id=${bookingId}`);
    } catch (err: any) {
      console.error("CardPayment: Payment failed", err);
      const errorMessage = err.message || "Payment failed";
      setError(errorMessage);
      setLastError(errorMessage);
      setLoading(false);
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    if (retryCount < 3) { // Max 3 retries
      handlePayment(true);
    }
  };

  const handleRevolutPayment = async () => {
    if (!amount) return;

    setLoading(true);
    setError("");

    try {
      // Create Revolut payment intent
      const response = await fetch("/api/payments/revolut/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountDkk: parseFloat(amount),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to create Revolut payment");
      }

      // Redirect to Revolut payment URL
      window.location.href = data.paymentUrl;
    } catch (err: any) {
      setError(err.message || "Revolut payment failed");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Setting up secure payment</h2>
            <p className="text-gray-600">Please wait while we initialize your payment...</p>
            <div className="mt-4 bg-gray-100 rounded-full h-2">
              <div className="bg-cyan-500 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-xl font-semibold text-red-700 mb-2">Payment Setup Failed</h2>
              <p className="text-red-600">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors"
              >
                🔄 Try Again
              </button>
              <button
                onClick={() => router.back()}
                className="block w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-colors"
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Complete Your Payment</h1>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {amount} DKK
            </div>
            <div className="text-gray-600">Taxi Booking Payment</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Secure Payment:</strong> Your payment information is encrypted and processed securely by Stripe.
            {isAdmin && (
              <span className="text-orange-600 font-semibold"> (Admin Mode - Mock Payment)</span>
            )}
          </div>

          <div className="flex items-center justify-center space-x-4 text-gray-400">
            <div className="text-2xl">💳</div>
            <div>Visa • Mastercard • American Express</div>
          </div>
        </div>

        {/* Payment Options for regular users */}
        {clientSecret && !isAdmin && stripe && (
          <div className="mt-6 space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Choose your payment method:</div>

            {/* Stripe Payment Option */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="stripe"
                    name="paymentProvider"
                    value="stripe"
                    defaultChecked
                    className="mr-2"
                  />
                  <label htmlFor="stripe" className="font-medium">💳 Stripe (Visa, Mastercard, Amex)</label>
                </div>
                <span className="text-xs text-gray-500">Secure</span>
              </div>
              <Elements stripe={stripe} options={{ clientSecret }}>
                <PaymentForm />
              </Elements>
            </div>

            {/* Revolut Payment Option */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="revolut"
                    name="paymentProvider"
                    value="revolut"
                    className="mr-2"
                  />
                  <label htmlFor="revolut" className="font-medium">🔄 Revolut</label>
                </div>
                <span className="text-xs text-gray-500">Fast</span>
              </div>
              <button
                onClick={handleRevolutPayment}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Continue with Revolut"}
              </button>
            </div>
          </div>
        )}

        {/* Fallback payment button for regular users when Stripe is not ready */}
        {clientSecret && !isAdmin && !stripe && (
          <div className="mt-6 space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Payment method:</div>
            <button
              onClick={() => handlePayment(false)}
              disabled={loading}
              className="w-full bg-black text-white py-4 px-6 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : `Pay ${amount} DKK`}
            </button>
          </div>
        )}

        {/* Mock payment button for admin users */}
        {isAdmin && (
          <div className="mt-8 space-y-4">
            <div className="space-y-3">
              <button
                onClick={() => handlePayment(false)}
                disabled={!clientSecret || isRetrying}
                className="w-full bg-black text-white py-4 px-6 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? "Retrying..." : `Pay ${amount} DKK (Mock)`}
              </button>

              {lastError && retryCount < 3 && (
                <button
                  onClick={handleRetry}
                  disabled={loading || isRetrying}
                  className="w-full bg-orange-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 Retry Payment ({retryCount}/3)
                </button>
              )}
            </div>

            <button
              onClick={() => router.back()}
              className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Retry Information */}
        {lastError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-500">⚠</span>
              <span className="text-red-700 text-sm font-medium">Payment Failed</span>
            </div>
            <p className="text-red-600 text-sm mb-2">{lastError}</p>
            {retryCount < 3 ? (
              <p className="text-gray-600 text-xs">
                You can retry up to 3 times. Attempt {retryCount}/3
              </p>
            ) : (
              <p className="text-gray-600 text-xs">
                Maximum retry attempts reached. Please contact support.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500 text-center">
          By completing this payment, you agree to our terms of service and privacy policy.
        </div>
      </div>
    </div>
  );
}

// Payment Form Component using Stripe Elements
function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount_dkk");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    console.log("PaymentForm: handleSubmit called", { retryCount, isRetrying });

    if (!stripe || !elements) {
      console.error("PaymentForm: Stripe or elements not available", { stripe: !!stripe, elements: !!elements });
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("PaymentForm: Confirming payment with Stripe");

      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pay/card/success?retry_count=${retryCount}`,
        },
      });

      if (submitError) {
        console.error("PaymentForm: Payment confirmation failed", submitError);
        const errorMessage = submitError.message || "Payment failed";
        setError(errorMessage);
        setLastError(errorMessage);
        setLoading(false);

        // Auto-retry for certain errors
        if (retryCount < 3 && (
          submitError.type === 'card_error' ||
          submitError.code === 'card_declined' ||
          submitError.code === 'processing_error'
        )) {
          console.log("PaymentForm: Auto-retrying payment due to recoverable error");
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setIsRetrying(true);
          }, 2000);
        }
      } else {
        console.log("PaymentForm: Payment confirmed successfully, redirecting to success page");
        // If successful, Stripe will redirect to return_url
      }
    } catch (err: any) {
      console.error("PaymentForm: Unexpected error during payment", err);
      const errorMessage = err.message || "An unexpected error occurred";
      setError(errorMessage);
      setLastError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠</span>
            <span className="text-red-700 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="submit"
          disabled={!stripe || loading || isRetrying}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
        >
          {loading || isRetrying ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              {isRetrying ? `Retrying... (${retryCount}/3)` : "Processing Payment..."}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>🔒</span>
              Pay {amount} DKK Securely
            </div>
          )}
        </button>

        {lastError && retryCount < 3 && !loading && (
          <button
            type="button"
            onClick={() => {
              setRetryCount(prev => prev + 1);
              setIsRetrying(true);
              setError("");
              // Trigger form submission again
              setTimeout(() => {
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }, 100);
            }}
            className="w-full bg-orange-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-orange-700 transition-colors"
          >
            🔄 Retry Payment ({retryCount}/3)
          </button>
        )}

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          ← Change Payment Method
        </button>
      </div>
    </form>
  );
}

export default function CardPayment() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading payment...</p>
        </div>
      </div>
    }>
      <CardPaymentContent />
    </Suspense>
  );
}
