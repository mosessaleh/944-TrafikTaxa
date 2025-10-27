"use client";
import { useState } from 'react';
import { BookingFormSchema, BookingFormInput } from '@/lib/validation';
import { sanitizeInput } from '@/lib/sanitize';

function LoadingSpinner() {
  return <div className="loading-spinner"></div>;
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
    <form onSubmit={submit} className="grid gap-4 animate-fade-in">
      {/* Rider name */}
      <label className="form-group">
        <span className="label">Passenger name (if booking for someone else)</span>
        <input
          className="input form-field"
          placeholder="Passenger full name"
          onChange={e=>setF({...f,riderName:sanitizeInput(e.target.value, 'text')})}
        />
        {validationErrors.riderName && <span className="form-error">{validationErrors.riderName}</span>}
      </label>

      {/* Passengers */}
      <label className="form-group">
        <span className="label">Number of passengers (max 4 per car)</span>
        <input
          className="input form-field"
          type="number"
          min={1}
          max={4}
          defaultValue={1}
          onChange={e=>setF({...f,passengers:Number(e.target.value)})}
        />
        {validationErrors.passengers && <span className="form-error">{validationErrors.passengers}</span>}
      </label>

      {/* Trip type */}
      <label className="form-group">
        <span className="label">Trip type</span>
        <select
          className="select form-field"
          value={f.tripType}
          onChange={e=>setF({...f,tripType:e.target.value as 'immediate'|'scheduled'})}
        >
          <option value="immediate">Immediate</option>
          <option value="scheduled">Schedule for later</option>
        </select>
        {validationErrors.tripType && <span className="form-error">{validationErrors.tripType}</span>}
      </label>

      {/* Pickup/Dropoff */}
      <label className="form-group">
        <span className="label">Pickup address (you can also enter lat,lng)</span>
        <input
          className="input form-field"
          placeholder="e.g., Rådhuspladsen, København or 55.676,12.568"
          onChange={e=>setF({...f,pickupAddress:sanitizeInput(e.target.value, 'address')})}
        />
        {validationErrors.pickupAddress && <span className="form-error">{validationErrors.pickupAddress}</span>}
      </label>

      <label className="form-group">
        <span className="label">Dropoff address (you can also enter lat,lng)</span>
        <input
          className="input form-field"
          placeholder="e.g., Copenhagen Airport or 55.618,12.65"
          onChange={e=>setF({...f,dropoffAddress:sanitizeInput(e.target.value, 'address')})}
        />
        {validationErrors.dropoffAddress && <span className="form-error">{validationErrors.dropoffAddress}</span>}
      </label>

      {/* When (only if scheduled) */}
      {scheduled && (
        <label className="form-group animate-slide-in">
          <span className="label">Pickup time</span>
          <input
            className="input form-field"
            type="datetime-local"
            onChange={e=>setF({...f,pickupTime: e.target.value? new Date(e.target.value).toISOString():''})}
          />
          {validationErrors.pickupTime && <span className="form-error">{validationErrors.pickupTime}</span>}
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={getQuote}
          disabled={isLoadingQuote}
          className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingQuote ? (
            <>
              <LoadingSpinner />
              Getting quote...
            </>
          ) : (
            'Get quote'
          )}
        </button>
        <button
          disabled={isSubmitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner />
              Booking...
            </>
          ) : (
            'Book now'
          )}
        </button>
      </div>

      {quote && (
        <div className="text-sm text-gray-700 animate-fade-in bg-gray-50 p-3 rounded-xl border">
          Distance ~ {quote.distanceKm.toFixed(2)} km · Duration ~ {quote.durationMin} min · Estimated price ~ {quote.price} DKK
        </div>
      )}
      {msg && <p className="form-success">{msg}</p>}
      {err && <p className="form-error">{err}</p>}
    </form>
  );
}
