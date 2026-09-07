import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { ApiRateLimitModule } from '../../shared/rate-limit/rate-limit.module.js';
import { OperixAuthModule } from '../auth/auth.module.js';
import { TodoController } from './todo.controller.js';
import { TodoService } from './todo.service.js';

@Module({
  imports: [PrismaModule, OperixAuthModule, ApiRateLimitModule],
  controllers: [TodoController],
  providers: [TodoService],
})
export class TodoModule {}
