import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsDefined } from 'class-validator';
import { GraphsService } from './graphs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class SaveGraphDto {
  @IsDefined()
  data: any; // 그래프 전체 상태 (객체/배열 — JSON 직렬화 가능 값)
}

@UseGuards(JwtAuthGuard)
@Controller('graphs')
export class GraphsController {
  constructor(private graphs: GraphsService) {}

  // 가계도/모임/학급 그래프 조회
  @Get(':kind')
  get(@CurrentUser() user: JwtPayload, @Param('kind') kind: string) {
    return this.graphs.get(user.sub, kind);
  }

  // 가계도/모임/학급 그래프 저장
  @Put(':kind')
  save(
    @CurrentUser() user: JwtPayload,
    @Param('kind') kind: string,
    @Body() dto: SaveGraphDto,
  ) {
    return this.graphs.save(user.sub, kind, dto.data);
  }
}
