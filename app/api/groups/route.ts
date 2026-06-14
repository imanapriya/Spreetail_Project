import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Helper to get logged-in user
async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get('session_user_id')?.value;
  if (!sessionUserId) return null;
  return prisma.user.findUnique({ where: { id: sessionUserId } });
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all groups where the user is a member
    const groupMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            members: {
              include: { user: true }
            }
          }
        }
      }
    });

    const groups = groupMemberships.map(gm => ({
      id: gm.group.id,
      name: gm.group.name,
      createdAt: gm.group.createdAt,
      members: gm.group.members.map(m => ({
        id: m.user.id,
        name: m.user.name,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt
      }))
    }));

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Fetch groups error:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, memberIds } = await request.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Create group and add members in a transaction
    const newGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name: name.trim() }
      });

      // Add the creator
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          joinedAt: new Date(),
        }
      });

      // Add other members if provided
      if (Array.isArray(memberIds)) {
        for (const mId of memberIds) {
          if (mId !== user.id) {
            await tx.groupMember.create({
              data: {
                groupId: group.id,
                userId: mId,
                joinedAt: new Date(),
              }
            });
          }
        }
      }

      return group;
    });

    return NextResponse.json(newGroup);
  } catch (error: any) {
    console.error('Create group error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
