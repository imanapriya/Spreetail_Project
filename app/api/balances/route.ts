import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let groupId = searchParams.get('groupId');

    // If no groupId is provided, default to the first group in the system
    if (!groupId) {
      const firstGroup = await prisma.group.findFirst();
      if (!firstGroup) {
        return NextResponse.json({
          transactions: [],
          breakdown: [],
          groups: []
        });
      }
      groupId = firstGroup.id;
    }

    const allGroups = await prisma.group.findMany({ orderBy: { name: 'asc' } });
    
    // Fetch members of this specific group
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true }
    });
    const users = groupMembers.map(gm => gm.user);
    const userMap = new Map(users.map(u => [u.id, u]));

    // Fetch expenses and settlements for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: { shares: true }
    });
    const settlements = await prisma.settlement.findMany({
      where: { groupId }
    });

    // Calculate net balances for each user in the group
    // positive = user owes money to the group
    // negative = group owes user money
    const balances: Record<string, number> = {};
    users.forEach(u => balances[u.id] = 0);

    // 1. Add their shares (amount they owe)
    for (const exp of expenses) {
      for (const share of exp.shares) {
        if (balances[share.userId] !== undefined) {
          balances[share.userId] += share.amountOwed;
        }
      }
      // 2. Subtract what they paid
      if (balances[exp.payerId] !== undefined) {
        balances[exp.payerId] -= exp.amount;
      }
    }

    // 3. Handle settlements
    for (const s of settlements) {
      if (balances[s.payerId] !== undefined) balances[s.payerId] -= s.amount;
      if (balances[s.payeeId] !== undefined) balances[s.payeeId] += s.amount;
    }

    // Rounding to avoid float precision issues
    Object.keys(balances).forEach(k => {
      balances[k] = Math.round(balances[k] * 100) / 100;
    });

    // Simplify debts (Greedy Settlement Simplification)
    const debtors: { userId: string; amount: number }[] = [];
    const creditors: { userId: string; amount: number }[] = [];

    for (const userId of Object.keys(balances)) {
      const b = balances[userId];
      if (b > 0.01) debtors.push({ userId, amount: b });
      else if (b < -0.01) creditors.push({ userId, amount: -b });
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amount = Math.min(debtor.amount, creditor.amount);
      transactions.push({
        from: userMap.get(debtor.userId)?.name,
        to: userMap.get(creditor.userId)?.name,
        amount: Math.round(amount * 100) / 100
      });

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // Prepare detailed breakdown per user (Rohan's Request)
    const breakdown = users.map(u => {
      const userExpenses = expenses.filter(e => e.payerId === u.id);
      const userShares = expenses.filter(e => e.shares.some(s => s.userId === u.id)).map(e => {
        const share = e.shares.find(s => s.userId === u.id)!;
        return { ...e, myShare: share.amountOwed };
      });
      const userSettlementsPaid = settlements.filter(s => s.payerId === u.id);
      const userSettlementsRcvd = settlements.filter(s => s.payeeId === u.id);

      return {
        user: u.name,
        netBalance: balances[u.id],
        paidExpensesCount: userExpenses.length,
        totalPaid: userExpenses.reduce((sum, e) => sum + e.amount, 0),
        shareCount: userShares.length,
        totalShareOwed: userShares.reduce((sum, e) => sum + e.myShare, 0),
        expenses: userExpenses,
        shares: userShares,
        settlementsPaid: userSettlementsPaid,
        settlementsRcvd: userSettlementsRcvd
      };
    });

    return NextResponse.json({
      transactions,
      breakdown,
      groups: allGroups,
      selectedGroupId: groupId
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}

