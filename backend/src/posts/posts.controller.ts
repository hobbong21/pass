import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class CreatePostDto {
  @IsString() @MaxLength(2000) content: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(['friends', 'extended', 'public']) audience?: string;
}

class UpdatePostDto {
  @IsOptional() @IsString() @MaxLength(2000) content?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

class CommentDto {
  @IsString() @MaxLength(500) content: string;
}

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private posts: PostsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.posts.create(user.sub, dto);
  }

  @Get('feed')
  feed(
    @CurrentUser() user: JwtPayload,
    @Query('filter') filter?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.posts.feed(user.sub, { filter, cursor, limit });
  }

  @Get(':id')
  byId(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.posts.byId(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.posts.delete(user.sub, id);
  }

  @Post(':id/like')
  toggleLike(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.posts.toggleLike(user.sub, id);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.posts.listComments(id);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CommentDto,
  ) {
    return this.posts.addComment(user.sub, id, dto.content);
  }

  @Delete('comments/:commentId')
  deleteComment(@CurrentUser() user: JwtPayload, @Param('commentId') cid: string) {
    return this.posts.deleteComment(user.sub, cid);
  }
}
