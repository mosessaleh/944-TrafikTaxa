import { NextResponse } from 'next/server';
import { z } from 'zod';

const LookupSchema = z.object({
  regNumber: z.string().regex(/^[A-Z]{2}\d{5}$/, 'Registration number must be in format XX12345'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = LookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid registration number format' }, { status: 400 });
    }

    const { regNumber } = parsed.data;

    // MotorAPI Integration
    const MOTORAPI_TOKEN = process.env.MOTORAPI_TOKEN || 'ng8iso4m5dtr7s6ku3lz41i7uzlnyk4k';

    try {
      console.log('Calling MotorAPI for regNumber:', regNumber);

      const response = await fetch(
        `https://v1.motorapi.dk/vehicles/${encodeURIComponent(regNumber)}`,
        {
          headers: {
            "X-AUTH-TOKEN": MOTORAPI_TOKEN,
          },
        }
      );

      console.log('MotorAPI response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('Vehicle not found in MotorAPI');
          return NextResponse.json({ ok: false, error: 'Vehicle not found in MotorAPI database' }, { status: 404 });
        }
        const errorText = await response.text();
        console.error('MotorAPI error:', response.status, errorText);
        throw new Error(`MotorAPI error: ${response.status} - ${errorText}`);
      }

      const apiData = await response.json();
      console.log('MotorAPI response data:', apiData);

      // Map MotorAPI response to our expected format
      // Adjust this mapping based on the actual MotorAPI response structure
      const vehicleData = {
        make: apiData.make || apiData.brand || apiData.manufacturer || '',
        model: apiData.model || '',
        variant: apiData.variant || apiData.version || apiData.trim || '',
        year: apiData.year || apiData.model_year || apiData.registration_year || 0,
        seats: apiData.seats || apiData.passengers || apiData.capacity || 0,
        color: apiData.color || '',
        fuel: apiData.fuel || apiData.fuel_type || '',
        vinNumber: apiData.vin || apiData.vin_number || apiData.chassis_number || '',
      };

      console.log('Mapped vehicle data:', vehicleData);
      return NextResponse.json({ ok: true, data: vehicleData });
    } catch (error) {
      console.error('MotorAPI integration error:', error);
      return NextResponse.json({ ok: false, error: 'Failed to connect to MotorAPI' }, { status: 500 });
    }
  } catch (e: any) {
    console.error('Vehicle lookup error:', e);
    return NextResponse.json({ ok: false, error: 'Failed to lookup vehicle' }, { status: 500 });
  }
}