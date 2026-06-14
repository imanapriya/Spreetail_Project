import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true }
    });

    return NextResponse.json(members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;
    const { userId, joinedAt, leftAt } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Upsert the GroupMember relation
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });

    const parsedJoined = joinedAt ? new Date(joinedAt) : new Date();
    const parsedLeft = leftAt ? new Date(leftAt) : null;

    let member;
    if (existingMember) {
      member = await prisma.groupMember.update({
        where: { id: existingMember.id },
        data: {
          joinedAt: parsedJoined,
          leftAt: parsedLeft
        }
      });
    } else {
      member = await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          joinedAt: parsedJoined,
          leftAt: parsedLeft
        }
      });
    }

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Update group member error:', error);
    return NextResponse.json({ error: 'Failed to update group membership' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete group member error:', error);
    return NextResponse.json({ error: 'Failed to remove member from group' }, { status: 500 });
  }
}
