import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const {
      description,
      amount,
      currency,
      date,
      payerId,
      groupId,
      splitType,
      shares // Array of { userId: string, value: number }
    } = await request.json();

    if (!description || !amount || !payerId || !groupId || !splitType || !shares || shares.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid expense amount' }, { status: 400 });
    }

    const parsedDate = new Date(date || new Date());

    // Create expense and its shares in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      // 1. Create the base Expense
      // Format splitDetails string for CSV parity/documentation
      let splitDetailsStr = '';
      if (splitType === 'percentage') {
        splitDetailsStr = shares.map((s: any) => `${s.userName} ${s.value}%`).join('; ');
      } else if (splitType === 'shares' || splitType === 'share') {
        splitDetailsStr = shares.map((s: any) => `${s.userName} ${s.value}`).join('; ');
      } else if (splitType === 'unequal') {
        splitDetailsStr = shares.map((s: any) => `${s.userName} ${s.value}`).join('; ');
      }

      const exp = await tx.expense.create({
        data: {
          date: parsedDate,
          description: description.trim(),
          amount: parsedAmount,
          currency: currency || 'INR',
          payerId,
          groupId,
          splitType,
          splitDetails: splitDetailsStr || null
        }
      });

      // 2. Create Expense Shares based on splitType
      if (splitType === 'equal') {
        const shareAmt = parsedAmount / shares.length;
        for (const s of shares) {
          await tx.expenseShare.create({
            data: {
              expenseId: exp.id,
              userId: s.userId,
              amountOwed: shareAmt
            }
          });
        }
      } else if (splitType === 'percentage') {
        let totalPct = shares.reduce((sum: number, s: any) => sum + parseFloat(s.value || 0), 0);
        for (const s of shares) {
          const pct = parseFloat(s.value || 0);
          // Normalize to sum of totalPct
          const normalizedPct = totalPct > 0 ? (pct / totalPct) * 100 : 0;
          const shareAmt = (parsedAmount * normalizedPct) / 100;
          
          await tx.expenseShare.create({
            data: {
              expenseId: exp.id,
              userId: s.userId,
              amountOwed: shareAmt
            }
          });
        }
      } else if (splitType === 'share' || splitType === 'shares') {
        const totalShares = shares.reduce((sum: number, s: any) => sum + parseFloat(s.value || 0), 0);
        for (const s of shares) {
          const sh = parseFloat(s.value || 0);
          const shareAmt = totalShares > 0 ? (parsedAmount * sh) / totalShares : 0;
          
          await tx.expenseShare.create({
            data: {
              expenseId: exp.id,
              userId: s.userId,
              amountOwed: shareAmt
            }
          });
        }
      } else if (splitType === 'unequal') {
        for (const s of shares) {
          const val = parseFloat(s.value || 0);
          await tx.expenseShare.create({
            data: {
              expenseId: exp.id,
              userId: s.userId,
              amountOwed: val
            }
          });
        }
      }

      return exp;
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
