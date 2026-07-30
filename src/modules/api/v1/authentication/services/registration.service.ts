import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  RegisterDto,
  RegisterMapper,
  RegistrationPendingDto,
} from '../models/register.model';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import { ActivityAuditService } from '@/modules/domain/audit/services/activity-audit.service';
import { IDENTITY_AUDIT_EVENTS } from '@/modules/domain/audit/constants/identity-audit.constants';
import { hashAuditIdentifier } from '@/modules/domain/audit/helpers/audit-privacy.helper';

@Injectable()
export class RegistrationService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly emailSvc: EmailVerificationService,
    private readonly userRepo: UserRepository,
    private readonly registrationTokenSvc: RegistrationTokenService,
    private readonly auditSvc: ActivityAuditService,
  ) {}

  public async register(dto: RegisterDto): Promise<RegistrationPendingDto> {
    const normalizedEmail: string = dto.email.trim().toLowerCase();
    const existingUser: UserEntity | null =
      await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const password: string = await this.userSvc.hashPassword(dto.password);

    const challenge = await this.emailSvc.sendRegistrationVerificationEmail(
      normalizedEmail,
      RegisterMapper.toRegistrationTokenMetadata(
        { ...dto, email: normalizedEmail },
        password,
      ),
    );

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.REGISTRATION_REQUESTED,
      domain: 'identity',
      outcome: 'pending',
      actorType: 'anonymous',
      source: 'http',
      metadata: { identifier_hash: hashAuditIdentifier(normalizedEmail) },
    });

    return new RegistrationPendingDto({
      message: 'Registration pending. Please verify your email address.',
      email: normalizedEmail,
      challenge_id: challenge.id,
      method: MfaMethod.EMAIL_OTP,
      expires_at: challenge.expires_at,
    });
  }

  public async resendRegistration(
    email: string,
  ): Promise<RegistrationPendingDto> {
    const normalizedEmail: string = email.trim().toLowerCase();
    const existingUser: UserEntity | null =
      await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const pendingToken: RegistrationTokenEntity | null =
      await this.registrationTokenSvc.findPendingByEmail(normalizedEmail);

    if (!pendingToken)
      throw new BadRequestException(
        'No pending registration exists for this email address.',
      );

    const challenge = await this.emailSvc.sendRegistrationVerificationEmail(
      normalizedEmail,
      pendingToken.metadata,
    );

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.REGISTRATION_VERIFICATION_RESENT,
      domain: 'identity',
      outcome: 'pending',
      actorType: 'anonymous',
      source: 'http',
      metadata: { identifier_hash: hashAuditIdentifier(normalizedEmail) },
    });

    return new RegistrationPendingDto({
      message: 'Registration pending. Please verify your email address.',
      email: normalizedEmail,
      challenge_id: challenge.id,
      method: MfaMethod.EMAIL_OTP,
      expires_at: challenge.expires_at,
    });
  }

  public async verifyRegistration(
    challengeId: string,
    code: string,
  ): Promise<UserEntity> {
    return this.emailSvc.verifyRegistrationToken(challengeId, code);
  }
}
