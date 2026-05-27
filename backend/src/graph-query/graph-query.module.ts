import { Module } from '@nestjs/common';
import { GraphQueryController } from './graph-query.controller';
import { GraphQueryService } from './graph-query.service';

@Module({
  controllers: [GraphQueryController],
  providers: [GraphQueryService],
  exports: [GraphQueryService],
})
export class GraphQueryModule {}
