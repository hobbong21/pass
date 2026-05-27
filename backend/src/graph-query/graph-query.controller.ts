import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';
import { GraphQueryService } from './graph-query.service';

/**
 * GET /graph/neighbors?kinds=family,friend
 * GET /graph/expand?depth=2&kinds=friend
 * GET /graph/path?to=USER_ID&maxDepth=4
 */
@UseGuards(JwtAuthGuard)
@Controller('graph')
export class GraphQueryController {
  constructor(private graph: GraphQueryService) {}

  @Get('neighbors')
  neighbors(
    @CurrentUser() user: JwtPayload,
    @Query('kinds') kinds?: string,
  ) {
    return this.graph.getNeighbors(user.sub, this.parseKinds(kinds));
  }

  @Get('expand')
  expand(
    @CurrentUser() user: JwtPayload,
    @Query('depth') depth?: string,
    @Query('kinds') kinds?: string,
  ) {
    const d = depth ? parseInt(depth, 10) : 2;
    if (Number.isNaN(d)) throw new BadRequestException('depth는 정수여야 합니다');
    return this.graph.expand(user.sub, d, this.parseKinds(kinds));
  }

  @Get('path')
  path(
    @CurrentUser() user: JwtPayload,
    @Query('to') to?: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    if (!to) throw new BadRequestException('to 쿼리 파라미터 필요');
    const d = maxDepth ? parseInt(maxDepth, 10) : 4;
    if (Number.isNaN(d)) throw new BadRequestException('maxDepth는 정수여야 합니다');
    return this.graph.findPath(user.sub, to, d);
  }

  private parseKinds(raw?: string): string[] | undefined {
    if (!raw) return undefined;
    const allowed = new Set(['family', 'friend', 'class']);
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const bad = list.find((k) => !allowed.has(k));
    if (bad) throw new BadRequestException(`알 수 없는 kind: ${bad}`);
    return list.length ? list : undefined;
  }
}
