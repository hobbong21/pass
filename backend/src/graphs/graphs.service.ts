import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const GRAPH_KINDS = ['family', 'group', 'class'] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];

@Injectable()
export class GraphsService {
  constructor(private prisma: PrismaService) {}

  private assertKind(kind: string) {
    if (!GRAPH_KINDS.includes(kind as GraphKind)) {
      throw new BadRequestException('알 수 없는 그래프 종류입니다 (family | group | class)');
    }
  }

  // ============================================================
  // 사용자별 그래프 조회 — 없으면 data: null (프론트가 기본값 사용)
  // ============================================================
  async get(userId: string, kind: string) {
    this.assertKind(kind);
    const g = await this.prisma.userGraph.findUnique({
      where: { userId_kind: { userId, kind } },
    });
    let data: any = null;
    if (g) {
      try { data = JSON.parse(g.data); } catch { data = null; }
    }
    return { kind, data, updatedAt: g?.updatedAt ?? null };
  }

  // ============================================================
  // 사용자별 그래프 저장 (upsert) — 그래프 전체를 JSON 문서로
  // ============================================================
  async save(userId: string, kind: string, data: any) {
    this.assertKind(kind);
    const json = JSON.stringify(data ?? null);
    const g = await this.prisma.userGraph.upsert({
      where: { userId_kind: { userId, kind } },
      update: { data: json },
      create: { userId, kind, data: json },
    });
    return { ok: true, kind, updatedAt: g.updatedAt };
  }
}
