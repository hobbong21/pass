import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPhone, normalizePhone } from '../common/hash.util';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 클라이언트가 보낸 (전화번호, 표시이름) 배열을 받아
   *  1) 해시로 가입자 매칭
   *  2) ContactLink 레코드 upsert
   *  3) 매칭된 사용자 정보 반환 (해시만 노출)
   *
   *  보안 원칙:
   *  - 평문 전화번호는 저장하지 않음 (hashedPhone만 보관)
   *  - target_phone은 미가입자 초대용으로만 옵션 저장 (이번 구현은 미저장)
   */
  async sync(ownerId: string, contacts: { phone: string; displayName?: string }[]) {
    if (!contacts || contacts.length === 0) return { ok: true, matched: 0, total: 0, links: [] };

    const inputs = contacts.map(c => ({
      hashedPhone: hashPhone(c.phone),
      displayName: c.displayName?.trim() || null,
    }));

    // 가입자 매칭 — 모든 user의 phone을 해시화하여 비교
    // 효율을 위해 hashedPhone 인덱스를 user에 두지 않았으므로 (개인정보 최소화),
    // 여기서는 각 hashedPhone에 대해 정규화 전화번호를 역추적할 수 없음.
    // 따라서 매칭은 user 전체를 한 번 가져와 해시 비교. (대규모는 별도 색인 테이블 필요)
    const users = await this.prisma.user.findMany({
      select: { id: true, phone: true, name: true, avatar: true },
    });
    const userByHash = new Map<string, { id: string; name: string | null; avatar: string | null }>();
    for (const u of users) {
      if (!u.phone) continue;
      userByHash.set(hashPhone(u.phone), { id: u.id, name: u.name, avatar: u.avatar });
    }

    const ops = inputs.map(inp => {
      const matched = userByHash.get(inp.hashedPhone) ?? null;
      return this.prisma.contactLink.upsert({
        where: { ownerId_hashedPhone: { ownerId, hashedPhone: inp.hashedPhone } },
        update: {
          displayName: inp.displayName,
          targetId: matched?.id ?? null,
        },
        create: {
          ownerId,
          hashedPhone: inp.hashedPhone,
          displayName: inp.displayName,
          targetId: matched?.id ?? null,
        },
      });
    });
    const links = await this.prisma.$transaction(ops);
    const matched = links.filter(l => l.targetId).length;

    return {
      ok: true,
      total: links.length,
      matched,
      links: links.map(l => ({
        id: l.id,
        hashedPhone: l.hashedPhone,
        displayName: l.displayName,
        targetId: l.targetId,
        registered: !!l.targetId,
      })),
    };
  }

  async list(ownerId: string) {
    const links = await this.prisma.contactLink.findMany({
      where: { ownerId },
      include: { target: true },
      orderBy: { createdAt: 'desc' },
    });
    return links.map(l => ({
      id: l.id,
      displayName: l.displayName,
      registered: !!l.targetId,
      target: l.target
        ? { id: l.target.id, email: l.target.email, name: l.target.name, avatar: l.target.avatar }
        : null,
      invitedAt: l.invitedAt,
      createdAt: l.createdAt,
    }));
  }

  /**
   * 미가입자에 대한 초대 마킹
   */
  async markInvited(ownerId: string, hashedPhone: string, channel: 'sms' | 'kakao' = 'sms') {
    await this.prisma.contactLink.update({
      where: { ownerId_hashedPhone: { ownerId, hashedPhone } },
      data: { invitedAt: new Date() },
    });
    return { ok: true };
  }

  async remove(ownerId: string, linkId: string) {
    await this.prisma.contactLink.deleteMany({
      where: { id: linkId, ownerId },
    });
    return { ok: true };
  }
}
