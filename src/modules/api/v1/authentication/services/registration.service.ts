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
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

@Injectable()
export class RegistrationService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly emailSvc: EmailVerificationService,
    private readonly userRepo: UserRepository,
    private readonly registrationTokenSvc: RegistrationTokenService,
    private readonly auditSvc: AuditService,
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
    const user = await this.emailSvc.verifyRegistrationToken(challengeId, code);

    await this.auditSvc.record({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
          .REGISTRATION_VERIFICATION_SUCCEEDED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'anonymous',
      actorId: null,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
    });

    return user;
  }
}
