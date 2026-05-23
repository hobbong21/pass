import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 작성
  // ============================================================
  async create(authorId: string, body: { content: string; imageUrl?: string; audience?: string }) {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: body.content,
        imageUrl: body.imageUrl ?? null,
        audience: body.audience ?? 'friends',
      },
    });
    return this.serialize(post, authorId);
  }

  async update(authorId: string, postId: string, body: { content?: string; imageUrl?: string | null }) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('포스트 없음');
    if (post.authorId !== authorId) throw new ForbiddenException('수정 권한 없음');
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: body.content ?? undefined,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl,
      },
    });
    return this.serialize(updated, authorId);
  }

  async delete(authorId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('포스트 없음');
    if (post.authorId !== authorId) throw new ForbiddenException('삭제 권한 없음');
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  // ============================================================
  // 피드
  //  filter: all | friends | extended | self
  // ============================================================
  async feed(userId: string, opts: { filter?: string; cursor?: string; limit?: number } = {}) {
    const filter = opts.filter ?? 'all';
    const rawLimit = Number(opts.limit);
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);

    // 시청 권한 — 1-hop confirmed
    const oneHop = await this.prisma.relation.findMany({
      where: { fromUserId: userId, kind: 'friend', status: 'confirmed' },
      select: { toUserId: true },
    });
    const friendIds = oneHop.map(r => r.toUserId);

    // 2-hop (extended)
    let extendedIds: string[] = [];
    if (filter === 'all' || filter === 'extended') {
      const fof = await this.prisma.relation.findMany({
        where: {
          fromUserId: { in: friendIds.length ? friendIds : ['_none_'] },
          kind: 'friend',
          status: 'confirmed',
        },
        select: { toUserId: true },
      });
      extendedIds = [...new Set(fof.map(r => r.toUserId))].filter(
        id => id !== userId && !friendIds.includes(id),
      );
    }

    let authorIds: string[];
    if (filter === 'self') {
      authorIds = [userId];
    } else if (filter === 'friends') {
      authorIds = [userId, ...friendIds];
    } else if (filter === 'extended') {
      authorIds = extendedIds;
    } else {
      // all
      authorIds = [userId, ...friendIds, ...extendedIds];
    }

    if (authorIds.length === 0) return { posts: [], nextCursor: null };

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        deletedAt: null,
        ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
        // extended 작성자의 글은 audience가 extended 또는 public이어야 봐짐
        ...(filter !== 'self' && filter !== 'friends'
          ? {
              OR: [
                { authorId: { in: [userId, ...friendIds] } }, // 본인+1hop 글은 모두
                {
                  authorId: { in: extendedIds },
                  audience: { in: ['extended', 'public'] },
                },
              ],
            }
          : {}),
      },
      include: { author: true },
      orderBy: { id: 'desc' }, // cuid는 시간순 정렬됨
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? slice[slice.length - 1].id : null;

    // 좋아요 여부 체크 (한 번에)
    const postIds = slice.map(p => p.id);
    const likes = await this.prisma.postLike.findMany({
      where: { postId: { in: postIds }, userId },
      select: { postId: true },
    });
    const likedSet = new Set(likes.map(l => l.postId));

    const items = slice.map(p => ({
      ...this.serialize(p, userId),
      author: this.publicUser(p.author),
      liked: likedSet.has(p.id),
      hop: p.authorId === userId ? 0 : friendIds.includes(p.authorId) ? 1 : 2,
    }));

    return { posts: items, nextCursor };
  }

  async byId(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { author: true },
    });
    if (!post || post.deletedAt) throw new NotFoundException('포스트 없음');
    const liked = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: viewerId } },
    });
    return {
      ...this.serialize(post, viewerId),
      author: this.publicUser(post.author),
      liked: !!liked,
    };
  }

  // ============================================================
  // 좋아요 토글
  // ============================================================
  async toggleLike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('포스트 없음');

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      await this.prisma.postLike.delete({ where: { id: existing.id } });
      await this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await this.prisma.postLike.create({ data: { postId, userId } });
      await this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
      return { liked: true };
    }
  }

  // ============================================================
  // 댓글
  // ============================================================
  async addComment(userId: string, postId: string, content: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('포스트 없음');
    const c = await this.prisma.postComment.create({
      data: { postId, userId, content },
    });
    await this.prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    return c;
  }

  async listComments(postId: string) {
    return this.prisma.postComment.findMany({
      where: { postId, deletedAt: null },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const c = await this.prisma.postComment.findUnique({ where: { id: commentId } });
    if (!c || c.deletedAt) throw new NotFoundException('댓글 없음');
    if (c.userId !== userId) throw new ForbiddenException('삭제 권한 없음');
    await this.prisma.postComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    await this.prisma.post.update({
      where: { id: c.postId },
      data: { commentCount: { decrement: 1 } },
    });
    return { ok: true };
  }

  // ============================================================
  // 헬퍼
  // ============================================================
  private serialize(p: any, viewerId?: string) {
    return {
      id: p.id,
      authorId: p.authorId,
      content: p.content,
      imageUrl: p.imageUrl,
      audience: p.audience,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      isMine: viewerId ? p.authorId === viewerId : false,
    };
  }
  private publicUser(u: any) {
    return u ? { id: u.id, name: u.name, avatar: u.avatar } : null;
  }
}
