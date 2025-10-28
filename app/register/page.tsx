"use client";
import { useState } from 'react';
import { RegisterSchema } from '@/lib/validation';
import AddressAutocomplete, { Suggestion } from '@/components/address-autocomplete';

export default function RegisterPage(){
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSubmitting(true);

    // Validate form
    const validation = RegisterSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      setIsSubmitting(false);
      console.log('Validation errors:', errors);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(formData)
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = { ok: response.ok };
      }

      if (!response.ok || !data.ok) {
        setError(data.error || `Registration failed (${response.status})`);
        return;
      }

      // Redirect to verification page
      const nextUrl = data.next || `/verify?email=${encodeURIComponent(formData.email)}`;
      window.location.href = nextUrl;
    } catch (ex: any) {
      setError(ex?.message || 'Unexpected error while registering');
    } finally {
      setTimeout(() => setIsSubmitting(false), 300);
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Create Account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@example.com"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password (minimum 8 characters)
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                required
              />
              {fieldErrors.firstName && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                value={formData.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                required
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <AddressAutocomplete
              label="Address"
              name="address"
              value={formData.address}
              onChange={(value) => updateField('address', value)}
              onSelect={(suggestion) => updateField('address', suggestion.text)}
              placeholder="Enter your address"
            />
            {fieldErrors.address && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.address}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-800 text-white py-2 px-4 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
