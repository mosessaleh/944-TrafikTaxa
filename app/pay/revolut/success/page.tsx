"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RevolutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    if (!paymentId) {
      setStatus("error");
      return;
    }

    const confirmPayment = async () => {
      try {
        const response = await fetch("/api/payments/revolut/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paymentId }),
        });

        const data = await response.json();

        if (response.ok && data.ok) {
          setStatus("success");
          setAmount(data.amount?.toString() || "");
        } else {
          setStatus("error");
        }
      } catch (err) {
        setStatus("error");
      }
    };

    confirmPayment();
  }, [paymentId]);

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Confirming your Revolut payment...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-4">Revolut Payment Verification Failed</h1>
          <p className="text-gray-600 mb-6">
            We couldn't verify your Revolut payment. Please contact support if you were charged.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pay")}
              className="block w-full bg-black text-white py-3 px-6 rounded-xl hover:bg-gray-800"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-300"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4">Revolut Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment of <strong>{amount} DKK</strong> has been processed successfully via Revolut.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="text-green-800">
            <div className="font-semibold mb-2">What happens next?</div>
            <ul className="text-left space-y-1 text-sm">
              <li>• You'll receive a confirmation email shortly</li>
              <li>• Our dispatcher will assign a driver</li>
              <li>• You'll get notified when your driver is on the way</li>
              <li>• Track your ride in your account dashboard</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/bookings")}
            className="block w-full bg-black text-white py-3 px-6 rounded-xl hover:bg-gray-800"
          >
            View My Bookings
          </button>
          <button
            onClick={() => router.push("/")}
            className="block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-300"
          >
            Book Another Ride
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RevolutSuccess() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <RevolutSuccessContent />
    </Suspense>
  );
}