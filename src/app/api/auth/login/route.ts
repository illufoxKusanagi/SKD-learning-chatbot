import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Endpoint ini sudah tidak digunakan. Gunakan NextAuth (/auth/login).',
      code: 'ENDPOINT_RETIRED',
    },
    { status: 410 }
  );
}
