import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module.js';
import { MailModule } from '../../shared/mail/mail.module.js';
import { ApiRateLimitModule } from '../../shared/rate-limit/rate-limit.module.js';
import { OperixAuthModule } from '../auth/auth.module.js';
import { AccountProvisioningService } from '../user-management/account-provisioning.service.js';
import {
  RegistrationController,
  RegistrationCronController,
} from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({
  imports: [PrismaModule, MailModule, OperixAuthModule, ApiRateLimitModule],
  controllers: [RegistrationController, RegistrationCronController],
  providers: [RegistrationService, AccountProvisioningService],
})
export class RegistrationModule {}
