import { NextResponse } from 'next/server';

// Quiet Chrome DevTools probe with an empty JSON
export function GET(){
  return NextResponse.json({}, { status: 200 });
}
