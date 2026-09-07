import { Controller, Get, Headers, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { ApplicationConfiguration } from '../../config/configuration.js';
import { AppException } from '../../shared/errors/app.exception.js';
import { TaskAutomationService } from './task-automation.service.js';

@ApiTags('internal')
@Controller('internal/cron')
export class TaskAutomationController {
  private readonly cronSecret: string;

  constructor(
    private readonly service: TaskAutomationService,
    configService: ConfigService<ApplicationConfiguration, true>,
  ) {
    this.cronSecret = configService.get('registration.cronSecret', {
      infer: true,
    });
  }

  @Get('task-automation')
  @AllowAnonymous()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  run(@Headers('authorization') authorization?: string) {
    if (authorization !== `Bearer ${this.cronSecret}`) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'CRON_AUTH_REQUIRED',
        'Authentication required.',
      );
    }
    return this.service.run();
  }
}
