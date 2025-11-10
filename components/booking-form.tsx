"use client";
import { useState } from 'react';
import { BookingFormSchema, BookingFormInput } from '@/lib/validation';
import { sanitizeInput } from '@/lib/sanitize';

function LoadingSpinner() {
  return (
    <div
      className="loading-spinner inline-block w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

function SkeletonLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} aria-hidden="true"></div>
  );
}

export default function BookingForm(){
   const [f,setF]=useState<BookingFormInput>({
     riderName:'',
     passengers:1,
     pickupAddress:'',
     dropoffAddress:'',
     tripType:'immediate', // 'immediate' | 'scheduled'
     pickupTime:'' // ISO when scheduled
   });
   const [quote,setQuote]=useState<any>(null);
   const [msg,setMsg]=useState('');
   const [err,setErr]=useState('');
   const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
   const [isLoadingQuote, setIsLoadingQuote] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const scheduled = f.tripType === 'scheduled';

  async function getQuote(){
    setErr(''); setMsg(''); setQuote(null); setValidationErrors({});
    setIsLoadingQuote(true);

    // Validate form before getting quote
    const validation = BookingFormSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      setIsLoadingQuote(false);
      return;
    }

    try {
      const whenISO = scheduled && f.pickupTime ? f.pickupTime : new Date().toISOString();
      const res = await fetch('/api/quote',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          pickupAddress: f.pickupAddress,
          dropoffAddress: f.dropoffAddress,
          passengers: Number(f.passengers),
          when: whenISO
        })
      });
      const j = await res.json();
      if(!j.ok){
        if(j.needTwoCars){ setErr('More than 4 passengers: please book two cars or reduce passengers.'); }
        else { setErr(j.error||'Failed to get quote'); }
        return;
      }
      setQuote(j);
    } catch (error) {
      setErr('Network error. Please try again.');
    } finally {
      setIsLoadingQuote(false);
    }
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setValidationErrors({});
    setIsSubmitting(true);

    if (!quote){ await getQuote(); if(!quote) { setIsSubmitting(false); return; } }

    // Validate form before submitting
    const validation = BookingFormSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/bookings',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          riderName: f.riderName || 'Self',
          passengers: Number(f.passengers),
          pickupAddress: f.pickupAddress,
          dropoffAddress: f.dropoffAddress,
          scheduled,
          pickupTime: scheduled && f.pickupTime ? f.pickupTime : new Date().toISOString()
        })
      });
      const j = await res.json();
      if(!j.ok){
        if(j.needTwoCars){ setErr('More than 4 passengers: please book two cars or cancel.'); }
        else { setErr(j.error||'Booking failed'); }
        return;
      }
      setMsg('Booking created successfully! We will contact you shortly.');
      setQuote(null);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      setErr('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 animate-fade-in"
      role="form"
      aria-labelledby="booking-form-title"
      noValidate
    >
      <h2 id="booking-form-title" className="sr-only">Taxi Booking Form</h2>

      {/* Rider name */}
      <div className="form-group" role="group" aria-labelledby="rider-name-label">
        <label htmlFor="rider-name" id="rider-name-label" className="label">
          Passenger name (if booking for someone else)
        </label>
        <input
          id="rider-name"
          className="input form-field"
          type="text"
          placeholder="Passenger full name"
          aria-describedby={validationErrors.riderName ? "rider-name-error" : undefined}
          aria-invalid={!!validationErrors.riderName}
          onChange={e=>setF({...f,riderName:sanitizeInput(e.target.value, 'text') || ''})}
          autoComplete="name"
        />
        {validationErrors.riderName && (
          <div id="rider-name-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
            <span className="text-red-500">⚠</span>
            <span>{validationErrors.riderName}</span>
          </div>
        )}
      </div>

      {/* Passengers */}
      <div className="form-group" role="group" aria-labelledby="passengers-label">
        <label htmlFor="passengers" id="passengers-label" className="label">
          Number of passengers (max 4 per car)
        </label>
        <input
          id="passengers"
          className="input form-field"
          type="number"
          min={1}
          max={4}
          defaultValue={1}
          aria-describedby={validationErrors.passengers ? "passengers-error" : "passengers-help"}
          aria-invalid={!!validationErrors.passengers}
          onChange={e=>setF({...f,passengers:Number(e.target.value)})}
        />
        <span id="passengers-help" className="sr-only">Maximum 4 passengers per vehicle</span>
        {validationErrors.passengers && (
          <div id="passengers-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
            <span className="text-red-500">⚠</span>
            <span>{validationErrors.passengers}</span>
          </div>
        )}
      </div>

      {/* Trip type */}
      <div className="form-group" role="group" aria-labelledby="trip-type-label">
        <label htmlFor="trip-type" id="trip-type-label" className="label">
          Trip type
        </label>
        <select
          id="trip-type"
          className="select form-field"
          value={f.tripType}
          aria-describedby={validationErrors.tripType ? "trip-type-error" : undefined}
          aria-invalid={!!validationErrors.tripType}
          onChange={e=>setF({...f,tripType:e.target.value as 'immediate'|'scheduled'})}
        >
          <option value="immediate">Immediate</option>
          <option value="scheduled">Schedule for later</option>
        </select>
        {validationErrors.tripType && (
          <div id="trip-type-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
            <span className="text-red-500">⚠</span>
            <span>{validationErrors.tripType}</span>
          </div>
        )}
      </div>

      {/* Pickup/Dropoff */}
      <div className="form-group" role="group" aria-labelledby="pickup-label">
        <label htmlFor="pickup-address" id="pickup-label" className="label">
          Pickup address (you can also enter lat,lng)
        </label>
        <input
          id="pickup-address"
          className="input form-field"
          type="text"
          placeholder="e.g., Rådhuspladsen, København or 55.676,12.568"
          aria-describedby={validationErrors.pickupAddress ? "pickup-error" : "pickup-help"}
          aria-invalid={!!validationErrors.pickupAddress}
          onChange={e=>setF({...f,pickupAddress:sanitizeInput(e.target.value, 'address') || ''})}
          autoComplete="address-line1"
        />
        <span id="pickup-help" className="sr-only">Enter pickup location or coordinates</span>
        {validationErrors.pickupAddress && (
          <div id="pickup-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
            <span className="text-red-500">⚠</span>
            <span>{validationErrors.pickupAddress}</span>
          </div>
        )}
      </div>

      <div className="form-group" role="group" aria-labelledby="dropoff-label">
        <label htmlFor="dropoff-address" id="dropoff-label" className="label">
          Dropoff address (you can also enter lat,lng)
        </label>
        <input
          id="dropoff-address"
          className="input form-field"
          type="text"
          placeholder="e.g., Copenhagen Airport or 55.618,12.65"
          aria-describedby={validationErrors.dropoffAddress ? "dropoff-error" : "dropoff-help"}
          aria-invalid={!!validationErrors.dropoffAddress}
          onChange={e=>setF({...f,dropoffAddress:sanitizeInput(e.target.value, 'address') || ''})}
          autoComplete="address-line2"
        />
        <span id="dropoff-help" className="sr-only">Enter destination location or coordinates</span>
        {validationErrors.dropoffAddress && (
          <div id="dropoff-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
            <span className="text-red-500">⚠</span>
            <span>{validationErrors.dropoffAddress}</span>
          </div>
        )}
      </div>

      {/* When (only if scheduled) */}
      {scheduled && (
        <div className="form-group animate-slide-in" role="group" aria-labelledby="pickup-time-label">
          <label htmlFor="pickup-time" id="pickup-time-label" className="label">
            Pickup time
          </label>
          <input
            id="pickup-time"
            className="input form-field"
            type="datetime-local"
            aria-describedby={validationErrors.pickupTime ? "pickup-time-error" : "pickup-time-help"}
            aria-invalid={!!validationErrors.pickupTime}
            onChange={e=>setF({...f,pickupTime: e.target.value? new Date(e.target.value).toISOString():''})}
            min={new Date().toISOString().slice(0, 16)}
          />
          <span id="pickup-time-help" className="sr-only">Select pickup date and time</span>
          {validationErrors.pickupTime && (
            <div id="pickup-time-error" className="form-error animate-fade-in flex items-center gap-1" role="alert" aria-live="polite">
              <span className="text-red-500">⚠</span>
              <span>{validationErrors.pickupTime}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2" role="group" aria-label="Form actions">
        <button
          type="button"
          onClick={getQuote}
          disabled={isLoadingQuote}
          className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
          aria-describedby="quote-button-status"
        >
          {isLoadingQuote ? (
            <>
              <LoadingSpinner aria-hidden="true" />
              <span id="quote-button-status">Getting quote...</span>
            </>
          ) : (
            'Get quote'
          )}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          aria-describedby="booking-button-status"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner aria-hidden="true" />
              <span id="booking-button-status">Booking...</span>
            </>
          ) : (
            'Book now'
          )}
        </button>
      </div>

      {/* Status messages */}
      {isLoadingQuote && !quote && (
        <div
          className="bg-gray-50 p-3 rounded-xl border animate-pulse"
          role="status"
          aria-live="polite"
          aria-label="Loading quote"
        >
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span>Calculating your fare...</span>
          </div>
          <div className="mt-2 space-y-1">
            <SkeletonLoader className="h-4 w-3/4" />
            <SkeletonLoader className="h-4 w-1/2" />
          </div>
        </div>
      )}

      {quote && (
        <div
          className="text-sm text-gray-700 animate-fade-in bg-green-50 p-3 rounded-xl border border-green-200"
          role="status"
          aria-live="polite"
          aria-label="Quote information"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-600">✓</span>
            <span className="font-medium text-green-800">Quote calculated</span>
          </div>
          <div className="text-gray-700">
            Distance ~ {quote.distanceKm.toFixed(2)} km · Duration ~ {quote.durationMin} min · Estimated price ~ {quote.price} DKK
          </div>
        </div>
      )}

      {msg && (
        <div
          className="form-success animate-fade-in border border-green-200 bg-green-50 p-3 rounded-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="font-medium text-green-800">Success!</span>
          </div>
          <p className="text-green-700 mt-1">{msg}</p>
        </div>
      )}

      {err && (
        <div
          className="form-error animate-fade-in border border-red-200 bg-red-50 p-3 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">⚠</span>
            <span className="font-medium text-red-800">Error</span>
          </div>
          <p className="text-red-700 mt-1">{err}</p>
          <button
            type="button"
            onClick={() => setErr('')}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}
    </form>
  );
}
