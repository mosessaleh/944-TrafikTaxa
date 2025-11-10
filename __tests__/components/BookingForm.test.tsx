import React from 'react';
import { render } from '@testing-library/react';
import { fireEvent, waitFor } from '@testing-library/dom';
import BookingForm from '../../components/booking-form';

// Mock fetch globally
global.fetch = jest.fn();

describe('BookingForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    const { getByPlaceholderText, getByText, getByDisplayValue } = render(<BookingForm />);

    expect(getByPlaceholderText('Passenger full name')).toBeTruthy();
    expect(getByDisplayValue('1')).toBeTruthy(); // passengers default
    expect(getByDisplayValue('Immediate')).toBeTruthy(); // trip type default
    expect(getByPlaceholderText('e.g., Rådhuspladsen, København or 55.676,12.568')).toBeTruthy();
    expect(getByPlaceholderText('e.g., Copenhagen Airport or 55.618,12.65')).toBeTruthy();
    expect(getByText('Get quote')).toBeTruthy();
    expect(getByText('Book now')).toBeTruthy();
  });

  it('shows pickup time field when scheduled is selected', () => {
    const { getByText, getByDisplayValue } = render(<BookingForm />);

    const select = getByDisplayValue('Immediate');
    fireEvent.change(select, { target: { value: 'scheduled' } });

    expect(getByText('Pickup time')).toBeTruthy();
  });

  it('calls getQuote when Get quote button is clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, distanceKm: 10, durationMin: 20, price: 150 }),
    });

    const { getByText, getByPlaceholderText } = render(<BookingForm />);

    const pickupInput = getByPlaceholderText('e.g., Rådhuspladsen, København or 55.676,12.568');
    const dropoffInput = getByPlaceholderText('e.g., Copenhagen Airport or 55.618,12.65');
    const getQuoteButton = getByText('Get quote');

    fireEvent.change(pickupInput, { target: { value: 'Test Pickup' } });
    fireEvent.change(dropoffInput, { target: { value: 'Test Dropoff' } });
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/quote', expect.any(Object));
    });
  });

  it('displays quote information after successful quote fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, distanceKm: 10.5, durationMin: 25, price: 200 }),
    });

    const { getByText, getByPlaceholderText } = render(<BookingForm />);

    const pickupInput = getByPlaceholderText('e.g., Rådhuspladsen, København or 55.676,12.568');
    const dropoffInput = getByPlaceholderText('e.g., Copenhagen Airport or 55.618,12.65');
    const getQuoteButton = getByText('Get quote');

    fireEvent.change(pickupInput, { target: { value: 'Test Pickup' } });
    fireEvent.change(dropoffInput, { target: { value: 'Test Dropoff' } });
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(getByText(/Distance ~ 10.50 km/)).toBeTruthy();
      expect(getByText(/Duration ~ 25 min/)).toBeTruthy();
      expect(getByText(/Estimated price ~ 200 DKK/)).toBeTruthy();
    });
  });

  it('shows validation errors for invalid form data', async () => {
    const { getByText, getByPlaceholderText } = render(<BookingForm />);

    const pickupInput = getByPlaceholderText('e.g., Rådhuspladsen, København or 55.676,12.568');
    const getQuoteButton = getByText('Get quote');

    // Enter invalid characters in pickup address and try to get quote
    fireEvent.change(pickupInput, { target: { value: '<script>alert("xss")</script>' } });
    fireEvent.click(getQuoteButton);

    await waitFor(() => {
      expect(getByText('Pickup address contains invalid characters')).toBeTruthy();
    });
  });
});