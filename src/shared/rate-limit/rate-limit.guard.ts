import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiRateLimitScope } from '../../../generated/prisma/enums.js';
import type { OperixRequest } from '../auth/operix-request.interface.js';
import { APP_ERROR_CODE } from '../errors/app-error-code.constant.js';
import { AppException } from '../errors/app.exception.js';
import { API_RATE_LIMIT_METADATA_KEY } from './rate-limit.constant.js';
import { ApiRateLimitService } from './rate-limit.service.js';

@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: ApiRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<
      ApiRateLimitScope | undefined
    >(API_RATE_LIMIT_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!scope) return true;

    const request = context.switchToHttp().getRequest<OperixRequest>();
    if (!request.operixViewer) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        APP_ERROR_CODE.AUTH_REQUIRED,
        'Authentication required.',
      );
    }

    await this.rateLimitService.consume(scope, request.operixViewer.userId);
    return true;
  }
}
