import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, passcode } = await request.json();

    if (!userId || !passcode) {
      return NextResponse.json({ error: 'User and passcode are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.passcode !== passcode) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name } });
    
    // Set secure HTTP-only cookie
    response.cookies.set('session_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
