import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const anomalies = await prisma.importAnomaly.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(anomalies);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
  }
}
