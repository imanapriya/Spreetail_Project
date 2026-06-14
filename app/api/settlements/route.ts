import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { payerId, payeeId, amount, date, groupId } = await request.json();

    if (!payerId || !payeeId || !amount || !groupId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid settlement amount' }, { status: 400 });
    }

    const settlement = await prisma.settlement.create({
      data: {
        date: date ? new Date(date) : new Date(),
        amount: parsedAmount,
        payerId,
        payeeId,
        groupId
      }
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error('Create settlement error:', error);
    return NextResponse.json({ error: 'Failed to record settlement' }, { status: 500 });
  }
}
