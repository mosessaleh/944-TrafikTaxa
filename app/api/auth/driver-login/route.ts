import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { comparePassword, signToken, setSessionCookie } from '@/lib/auth';

const Schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(req: NextRequest){
  try{
    const { username, password } = Schema.parse(await req.json());

    const driver = await prisma.comDriver.findUnique({
      where: { drUsername: username },
      select: {
        id: true,
        drPass: true,
        isActive: true,
        company: {
          select: {
            comStatus: true
          }
        }
      }
    });

    if (!driver || !driver.isActive || !driver.company.comStatus) {
      return NextResponse.json({ ok:false, error:'Invalid credentials' }, { status: 401 });
    }

    const valid = await comparePassword(password, driver.drPass);
    if (!valid) {
      return NextResponse.json({ ok:false, error:'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: driver.id, driverId: driver.id, type: 'driver' });
    await setSessionCookie(token);

    return NextResponse.json({ ok:true, message:'Logged in successfully' });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 });
  }
}
