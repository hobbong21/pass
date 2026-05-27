import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { RelationsModule } from './relations/relations.module';
import { PostsModule } from './posts/posts.module';
import { ChatModule } from './chat/chat.module';
import { GraphsModule } from './graphs/graphs.module';
import { GraphQueryModule } from './graph-query/graph-query.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },       // 1초당 5회
      { name: 'medium', ttl: 60_000, limit: 100 },  // 1분당 100회
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    RelationsModule,
    PostsModule,
    ChatModule,
    GraphsModule,
    GraphQueryModule,
  ],
})
export class AppModule {}
