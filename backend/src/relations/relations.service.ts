import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RelationKind = 'family' | 'friend' | 'class';
export type RelationStatus = 'pending' | 'confirmed' | 'rejected' | 'revoked';

@Injectable()
export class RelationsService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 관계 요청 — fromUser → toUser
  // status는 PENDING으로 시작 (상대방 confirm 시 confirmed)
  //
  // pending은 본질적으로 단방향(요청자→대상)이므로 한 방향만 저장.
  // confirmed 시점에 respond()에서 역방향 edge를 mirror — 그때
  // mirrorSubtype()이 family/class kind에 맞게 대칭 변환함.
  // ============================================================
  async request(
    fromUserId: string,
    body: {
      toUserId: string;
      kind: RelationKind;
      subtype?: string;       // family: tier / friend: hop / class: role
      meta?: Record<string, any>;
      birthOrder?: number;
    },
  ) {
    if (fromUserId === body.toUserId) throw new BadRequestException('자기 자신과는 관계를 만들 수 없습니다');

    const to = await this.prisma.user.findUnique({ where: { id: body.toUserId } });
    if (!to) throw new NotFoundException('대상 사용자 없음');

    const existing = await this.prisma.relation.findUnique({
      where: { fromUserId_toUserId_kind: { fromUserId, toUserId: body.toUserId, kind: body.kind } },
    });
    if (existing && existing.status === 'confirmed') {
      throw new BadRequestException('이미 인증된 관계입니다');
    }

    const data = {
      fromUserId,
      toUserId: body.toUserId,
      kind: body.kind,
      subtype: body.subtype ?? null,
      meta: body.meta ? JSON.stringify(body.meta) : null,
      birthOrder: body.birthOrder ?? null,
      status: 'pending' as const,
    };
    const rel = existing
      ? await this.prisma.relation.update({ where: { id: existing.id }, data })
      : await this.prisma.relation.create({ data });

    return this.serialize(rel);
  }

  // 상대방이 응답 (confirm or reject)
  async respond(toUserId: string, relationId: string, action: 'confirm' | 'reject') {
    const rel = await this.prisma.relation.findUnique({ where: { id: relationId } });
    if (!rel) throw new NotFoundException('관계 없음');
    if (rel.toUserId !== toUserId) throw new ForbiddenException('응답 권한 없음');
    if (rel.status !== 'pending') throw new BadRequestException('이미 처리된 요청입니다');

    const updated = await this.prisma.relation.update({
      where: { id: relationId },
      data: {
        status: action === 'confirm' ? 'confirmed' : 'rejected',
        confirmedAt: action === 'confirm' ? new Date() : null,
      },
    });

    // 양방향 자동 생성 — confirm 시 상대 방향 관계도 confirmed로 mirror (kind에 따라)
    if (action === 'confirm') {
      await this.prisma.relation.upsert({
        where: { fromUserId_toUserId_kind: { fromUserId: rel.toUserId, toUserId: rel.fromUserId, kind: rel.kind } },
        update: { status: 'confirmed', confirmedAt: new Date() },
        create: {
          fromUserId: rel.toUserId,
          toUserId: rel.fromUserId,
          kind: rel.kind,
          subtype: this.mirrorSubtype(rel.kind, rel.subtype),
          status: 'confirmed',
          confirmedAt: new Date(),
        },
      });
    }
    return this.serialize(updated);
  }

  async revoke(userId: string, relationId: string) {
    const rel = await this.prisma.relation.findUnique({ where: { id: relationId } });
    if (!rel) throw new NotFoundException('관계 없음');
    if (rel.fromUserId !== userId && rel.toUserId !== userId) {
      throw new ForbiddenException('권한 없음');
    }
    await this.prisma.relation.update({
      where: { id: relationId },
      data: { status: 'revoked' },
    });
    // 반대 방향도 revoked
    await this.prisma.relation.updateMany({
      where: { fromUserId: rel.toUserId, toUserId: rel.fromUserId, kind: rel.kind },
      data: { status: 'revoked' },
    });
    return { ok: true };
  }

  // ============================================================
  // 조회 — kind 별 1-hop / 2-hop / 가계도 tier / 학급 role
  // ============================================================
  async listMine(userId: string, opts: { kind?: RelationKind; status?: RelationStatus } = {}) {
    const rels = await this.prisma.relation.findMany({
      where: {
        fromUserId: userId,
        kind: opts.kind ?? undefined,
        status: opts.status ?? undefined,
      },
      include: { to: true },
      orderBy: { createdAt: 'desc' },
    });
    return rels.map(r => ({
      ...this.serialize(r),
      to: r.to ? this.publicUser(r.to) : null,
    }));
  }

  /// 2-hop — 모임원의 모임원
  async friendsOfFriends(userId: string) {
    // 1-hop (confirmed friends)
    const oneHop = await this.prisma.relation.findMany({
      where: { fromUserId: userId, kind: 'friend', status: 'confirmed' },
      select: { toUserId: true },
    });
    const oneHopIds = oneHop.map(r => r.toUserId);
    if (oneHopIds.length === 0) return [];

    // 2-hop — confirmed friends of 1-hop, excluding userId and 1-hop set
    const twoHop = await this.prisma.relation.findMany({
      where: {
        fromUserId: { in: oneHopIds },
        kind: 'friend',
        status: 'confirmed',
        toUserId: { notIn: [userId, ...oneHopIds] },
      },
      include: { to: true, from: true },
    });

    // 중복 제거 + via 정보 집계
    const byUser = new Map<string, { user: any; viaIds: Set<string> }>();
    for (const r of twoHop) {
      const existing = byUser.get(r.toUserId);
      if (existing) {
        existing.viaIds.add(r.fromUserId);
      } else {
        byUser.set(r.toUserId, { user: r.to, viaIds: new Set([r.fromUserId]) });
      }
    }
    return Array.from(byUser.values()).map(v => ({
      user: this.publicUser(v.user),
      viaUserIds: Array.from(v.viaIds),
    }));
  }

  /// 가계도 트리 (family kind만, tier별 그룹)
  async familyTree(userId: string) {
    const rels = await this.prisma.relation.findMany({
      where: { fromUserId: userId, kind: 'family' },
      include: { to: true },
      orderBy: { birthOrder: 'asc' },
    });

    const byTier: Record<string, any[]> = {};
    for (const r of rels) {
      const tier = r.subtype || 'other';
      if (!byTier[tier]) byTier[tier] = [];
      let meta: any = null;
      try { meta = r.meta ? JSON.parse(r.meta) : null; } catch {}
      byTier[tier].push({
        relationId: r.id,
        status: r.status,
        birthOrder: r.birthOrder,
        rel: meta?.rel ?? null,
        meta,
        person: this.publicUser(r.to),
      });
    }
    return byTier;
  }

  /// 학급 — role별 그룹
  async classRoster(userId: string) {
    const rels = await this.prisma.relation.findMany({
      where: { fromUserId: userId, kind: 'class' },
      include: { to: true },
    });
    const byRole: Record<string, any[]> = { teacher: [], student: [], parent: [] };
    for (const r of rels) {
      const role = r.subtype || 'student';
      let meta: any = null;
      try { meta = r.meta ? JSON.parse(r.meta) : null; } catch {}
      (byRole[role] = byRole[role] || []).push({
        relationId: r.id,
        status: r.status,
        attendanceNo: meta?.attendanceNo ?? null,
        person: this.publicUser(r.to),
      });
    }
    return byRole;
  }

  /// 수신함 — 나에게 들어온 PENDING 요청들
  async incoming(userId: string) {
    const rels = await this.prisma.relation.findMany({
      where: { toUserId: userId, status: 'pending' },
      include: { from: true },
      orderBy: { createdAt: 'desc' },
    });
    return rels.map(r => ({
      ...this.serialize(r),
      from: this.publicUser(r.from),
    }));
  }

  // ============================================================
  // 헬퍼
  // ============================================================
  private serialize(r: any) {
    let meta: any = null;
    try { meta = r.meta ? JSON.parse(r.meta) : null; } catch {}
    return {
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      kind: r.kind,
      subtype: r.subtype,
      status: r.status,
      birthOrder: r.birthOrder,
      meta,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
    };
  }

  private publicUser(u: any) {
    return u ? { id: u.id, email: u.email, name: u.name, avatar: u.avatar } : null;
  }

  /// 가족 tier 대칭 매핑 — 윗세대/아랫세대는 뒤집고, 동세대/배우자는 그대로
  /// 정확한 호칭(아버지/아들 등)은 meta에 보관하고 여기서는 tier만 다룸
  private static readonly FAMILY_TIER_MIRROR: Record<string, string> = {
    grandparents:       'grandchildren',
    grandchildren:      'grandparents',
    parents:            'children',
    children:           'parents',
    'parents-in-law':   'children-in-law',
    'children-in-law':  'parents-in-law',
    'aunts-uncles':     'nieces-nephews',
    'nieces-nephews':   'aunts-uncles',
    siblings:           'siblings',
    'siblings-in-law':  'siblings-in-law',
    spouse:             'spouse',
    cousins:            'cousins',
  };

  /// 친구 hop 미러링은 그대로 (양쪽 거리 동일)
  /// 학급 role 미러링: teacher↔student, parent는 그대로
  private static readonly CLASS_ROLE_MIRROR: Record<string, string> = {
    teacher: 'student',
    student: 'teacher',
    parent:  'parent',
  };

  private mirrorSubtype(kind: string, subtype: string | null): string | null {
    if (!subtype) return null;
    if (kind === 'family') return RelationsService.FAMILY_TIER_MIRROR[subtype] ?? subtype;
    if (kind === 'class')  return RelationsService.CLASS_ROLE_MIRROR[subtype] ?? subtype;
    // friend hop은 양쪽 동일
    return subtype;
  }
}
