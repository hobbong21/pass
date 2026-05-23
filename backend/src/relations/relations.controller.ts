import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { RelationsService, RelationKind, RelationStatus } from './relations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class RequestRelationDto {
  @IsString() toUserId: string;
  @IsIn(['family', 'friend', 'class']) kind: RelationKind;
  @IsOptional() @IsString() subtype?: string;
  @IsOptional() @IsObject() meta?: Record<string, any>;
  @IsOptional() @IsInt() birthOrder?: number;
}

class RespondDto {
  @IsIn(['confirm', 'reject']) action: 'confirm' | 'reject';
}

@UseGuards(JwtAuthGuard)
@Controller('relations')
export class RelationsController {
  constructor(private rel: RelationsService) {}

  @Post()
  request(@CurrentUser() user: JwtPayload, @Body() dto: RequestRelationDto) {
    return this.rel.request(user.sub, dto);
  }

  @Patch(':id/respond')
  respond(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondDto,
  ) {
    return this.rel.respond(user.sub, id, dto.action);
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.rel.revoke(user.sub, id);
  }

  @Get('me')
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('kind') kind?: RelationKind,
    @Query('status') status?: RelationStatus,
  ) {
    return this.rel.listMine(user.sub, { kind, status });
  }

  @Get('incoming')
  incoming(@CurrentUser() user: JwtPayload) {
    return this.rel.incoming(user.sub);
  }

  @Get('friends-of-friends')
  fof(@CurrentUser() user: JwtPayload) {
    return this.rel.friendsOfFriends(user.sub);
  }

  @Get('family-tree')
  familyTree(@CurrentUser() user: JwtPayload) {
    return this.rel.familyTree(user.sub);
  }

  @Get('class-roster')
  classRoster(@CurrentUser() user: JwtPayload) {
    return this.rel.classRoster(user.sub);
  }
}
