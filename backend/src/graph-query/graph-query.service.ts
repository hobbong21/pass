import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 관계 그래프에 대한 범용 조회.
 * Relation 엣지가 양방향으로 정규화되어 있다는 전제 위에서 동작
 * (RelationsService.request()가 양방향 pending edge를 보장).
 */
@Injectable()
export class GraphQueryService {
  // 안전 상한 — 개인 관계망 규모를 고려한 보수적 값
  private static readonly MAX_DEPTH = 5;
  private static readonly MAX_PATH_DEPTH = 6;

  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 1-hop 이웃 — kind 필터 가능. confirmed 상태만.
  // ============================================================
  async getNeighbors(userId: string, kinds?: string[]) {
    const rels = await this.prisma.relation.findMany({
      where: {
        fromUserId: userId,
        status: 'confirmed',
        ...(kinds && kinds.length ? { kind: { in: kinds } } : {}),
      },
      include: { to: true },
      orderBy: { createdAt: 'desc' },
    });
    return rels.map((r) => ({
      relationId: r.id,
      kind: r.kind,
      subtype: r.subtype,
      birthOrder: r.birthOrder,
      user: this.publicUser(r.to),
    }));
  }

  // ============================================================
  // N-hop BFS 확장 — depth 별 신규 사용자 목록을 레이어로 반환.
  // 같은 사용자는 가장 가까운 레이어에만 등장 (중복 제거).
  // ============================================================
  async expand(userId: string, depth: number, kinds?: string[]) {
    const d = Math.min(Math.max(1, Math.floor(depth) || 1), GraphQueryService.MAX_DEPTH);

    const visited = new Set<string>([userId]);
    const layers: Array<{ hop: number; userIds: string[] }> = [];
    let frontier: string[] = [userId];

    for (let h = 1; h <= d; h++) {
      if (frontier.length === 0) break;
      const rels = await this.prisma.relation.findMany({
        where: {
          fromUserId: { in: frontier },
          status: 'confirmed',
          ...(kinds && kinds.length ? { kind: { in: kinds } } : {}),
          toUserId: { notIn: Array.from(visited) },
        },
        select: { toUserId: true },
      });
      const next = Array.from(new Set(rels.map((r) => r.toUserId))).filter((id) => !visited.has(id));
      if (next.length === 0) break;
      next.forEach((id) => visited.add(id));
      layers.push({ hop: h, userIds: next });
      frontier = next;
    }

    // 사용자 정보 일괄 조회
    const allIds = layers.flatMap((l) => l.userIds);
    const users = allIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: allIds } },
          select: { id: true, name: true, email: true, avatar: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return layers.map((l) => ({
      hop: l.hop,
      users: l.userIds
        .map((id) => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u)),
    }));
  }

  // ============================================================
  // 최단 경로 — fromUser → toUser 사이의 엣지 체인을 반환.
  // 도달 불가능하면 null.
  // ============================================================
  async findPath(fromUserId: string, toUserId: string, maxDepth = 4) {
    if (fromUserId === toUserId) return [];
    if (!toUserId) throw new BadRequestException('to 사용자 ID 필요');
    const cap = Math.min(Math.max(1, Math.floor(maxDepth) || 4), GraphQueryService.MAX_PATH_DEPTH);

    // 각 노드의 부모 + 들어온 엣지 정보를 기록 (BFS 경로 복원용)
    type Parent = { via: string; kind: string; subtype: string | null };
    const parents = new Map<string, Parent | null>();
    parents.set(fromUserId, null);

    let frontier: string[] = [fromUserId];
    let found = false;

    for (let h = 1; h <= cap && !found; h++) {
      if (frontier.length === 0) break;
      const rels = await this.prisma.relation.findMany({
        where: {
          fromUserId: { in: frontier },
          status: 'confirmed',
          toUserId: { notIn: Array.from(parents.keys()) },
        },
        select: { fromUserId: true, toUserId: true, kind: true, subtype: true },
      });
      const next: string[] = [];
      for (const r of rels) {
        if (parents.has(r.toUserId)) continue;
        parents.set(r.toUserId, { via: r.fromUserId, kind: r.kind, subtype: r.subtype });
        next.push(r.toUserId);
        if (r.toUserId === toUserId) { found = true; break; }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    if (!parents.has(toUserId)) return null;

    // 경로 복원 (toUser → fromUser 역추적 후 뒤집기)
    const edgesReverse: Array<{ from: string; to: string; kind: string; subtype: string | null }> = [];
    let cur = toUserId;
    while (true) {
      const p = parents.get(cur);
      if (!p) break;
      edgesReverse.push({ from: p.via, to: cur, kind: p.kind, subtype: p.subtype });
      cur = p.via;
    }
    const edges = edgesReverse.reverse();

    // 경로 상의 사용자 정보 hydrate
    const ids = new Set<string>();
    edges.forEach((e) => { ids.add(e.from); ids.add(e.to); });
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, name: true, email: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return edges.map((e) => ({
      ...e,
      fromUser: userMap.get(e.from) ?? null,
      toUser: userMap.get(e.to) ?? null,
    }));
  }

  private publicUser(u: { id: string; email: string; name: string | null; avatar: string | null } | null) {
    return u ? { id: u.id, email: u.email, name: u.name, avatar: u.avatar } : null;
  }
}
