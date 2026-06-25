import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import {
  RegisterDto,
  RegisterMapper,
  RegistrationPendingDto,
} from '../models/register.model';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import { RegistrationTokenEntity } from '@/modules/domain/identity/entities/registration-token.entity';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly emailSvc: EmailVerificationService,
    private readonly userRepo: UserRepository,
    private readonly registrationTokenSvc: RegistrationTokenService,
  ) {}

  public async register(dto: RegisterDto): Promise<RegistrationPendingDto> {
    const normalizedEmail: string = dto.email.trim().toLowerCase();
    const existingUser: UserEntity | null =
      await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser)
      throw new ConflictException('A user with this email already exists.');

    const password: string = await this.userSvc.hashPassword(dto.password);

    await this.emailSvc.sendRegistrationVerificationEmail(
      normalizedEmail,
      RegisterMapper.toRegistrationTokenMetadata(
        { ...dto, email: normalizedEmail },
        password,
      ),
    );

    return new RegistrationPendingDto({
      message: 'Registration pending. Please verify your email address.',
      email: normalizedEmail,
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

    await this.emailSvc.sendRegistrationVerificationEmail(
      normalizedEmail,
      pendingToken.metadata,
    );

    return new RegistrationPendingDto({
      message: 'Registration pending. Please verify your email address.',
      email: normalizedEmail,
    });
  }

  public async validateRegistration(
    tokenId: string,
    token: string,
  ): Promise<void> {
    await this.registrationTokenSvc.validateToken(tokenId, token);
  }

  public async verifyRegistration(
    tokenId: string,
    token: string,
    mfaCode: string,
  ): Promise<void> {
    await this.emailSvc.verifyRegistrationToken(tokenId, token, mfaCode);
  }

  public async signIn(user: UserEntity, res: Response): Promise<JWTDto> {
    const updated = await this.userSvc.recordSignIn(user);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async verify(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res);
  }

  public async signOut(user: UserEntity, res: Response): Promise<void> {
    await this.refreshSvc.revokeTokens(user, res);
  }
}
