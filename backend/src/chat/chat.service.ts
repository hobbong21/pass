import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 1:1 대화방 — userAId < userBId 정렬해서 유일성 보장
  // ============================================================
  private pair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  async getOrCreateConversation(viewerId: string, otherId: string) {
    if (viewerId === otherId) throw new ForbiddenException('자기 자신과 대화 불가');
    const [a, b] = this.pair(viewerId, otherId);
    const existing = await this.prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { userAId: a, userBId: b },
    });
  }

  async listConversations(userId: string) {
    const convs = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: { userA: true, userB: true },
      orderBy: { lastAt: 'desc' },
    });

    // 안 읽음 수 — 본인이 아직 read 안 한 메시지 카운트
    const convIds = convs.map(c => c.id);
    const unread = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: convIds },
        senderId: { not: userId },
        reads: { none: { userId } },
      },
      _count: { _all: true },
    });
    const unreadByConv = new Map(unread.map(u => [u.conversationId, u._count._all]));

    return convs.map(c => {
      const other = c.userAId === userId ? c.userB : c.userA;
      return {
        id: c.id,
        other: this.publicUser(other),
        lastMessage: c.lastMessage,
        lastAt: c.lastAt,
        unread: unreadByConv.get(c.id) ?? 0,
      };
    });
  }

  async getConversation(viewerId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { userA: true, userB: true },
    });
    if (!conv) throw new NotFoundException('대화방 없음');
    if (conv.userAId !== viewerId && conv.userBId !== viewerId) {
      throw new ForbiddenException('접근 권한 없음');
    }
    const other = conv.userAId === viewerId ? conv.userB : conv.userA;
    return {
      id: conv.id,
      other: this.publicUser(other),
      lastMessage: conv.lastMessage,
      lastAt: conv.lastAt,
    };
  }

  // ============================================================
  // 메시지
  // ============================================================
  async listMessages(
    viewerId: string,
    conversationId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('대화방 없음');
    if (conv.userAId !== viewerId && conv.userBId !== viewerId) throw new ForbiddenException();

    const rawLimit = Number(opts.limit);
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 100);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = messages.length > limit;
    const slice = (hasMore ? messages.slice(0, limit) : messages).reverse();
    return {
      messages: slice.map(m => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        createdAt: m.createdAt,
        isMine: m.senderId === viewerId,
      })),
      nextCursor: hasMore ? messages[messages.length - 1].id : null,
    };
  }

  async sendMessage(senderId: string, conversationId: string, text: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('대화방 없음');
    if (conv.userAId !== senderId && conv.userBId !== senderId) throw new ForbiddenException();
    if (!text.trim()) throw new ForbiddenException('빈 메시지');

    const msg = await this.prisma.message.create({
      data: { conversationId, senderId, text: text.trim() },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: msg.text.slice(0, 140), lastAt: msg.createdAt },
    });
    return {
      id: msg.id,
      senderId: msg.senderId,
      text: msg.text,
      createdAt: msg.createdAt,
      isMine: true,
    };
  }

  async markRead(viewerId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('대화방 없음');
    if (conv.userAId !== viewerId && conv.userBId !== viewerId) throw new ForbiddenException();

    // 안 읽은 메시지들 모두 read 처리
    const unread = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: viewerId },
        reads: { none: { userId: viewerId } },
      },
      select: { id: true },
    });
    if (unread.length === 0) return { ok: true, marked: 0 };

    await this.prisma.messageRead.createMany({
      data: unread.map(m => ({ messageId: m.id, userId: viewerId })),
    });
    return { ok: true, marked: unread.length };
  }

  async deleteMessage(viewerId: string, messageId: string) {
    const m = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!m || m.deletedAt) throw new NotFoundException('메시지 없음');
    if (m.senderId !== viewerId) throw new ForbiddenException('삭제 권한 없음');
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), text: '(삭제된 메시지입니다)' },
    });
    return { ok: true };
  }

  private publicUser(u: any) {
    return u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : null;
  }
}
