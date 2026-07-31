jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import type { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import type { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import type { RegisterDto } from '../models/register.model';
import { RegistrationService } from './registration.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { hashAuditIdentifier } from '@/modules/domain/audit/helpers/audit-privacy.helper';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

describe('RegistrationService', () => {
  const dto = {
    email: '  Person@Example.TEST ',
    password: 'Password1!',
    first_name: 'Pat',
    last_name: 'Person',
    dob: '1990-01-01',
    gender_id: 'gender',
    country_id: 'country',
    timezone_id: 'timezone',
  } as RegisterDto;
  const expires = new Date('2026-02-01T00:00:00Z');
  const metadata = {
    email: 'person@example.test',
    password: 'hashed',
    profile: expect.any(Object),
  };

  const setup = () => {
    const userSvc = { hashPassword: jest.fn().mockResolvedValue('hashed') };
    const emailSvc = {
      sendRegistrationVerificationEmail: jest
        .fn()
        .mockResolvedValue({ id: 'challenge-1', expires_at: expires }),
      verifyRegistrationToken: jest.fn().mockResolvedValue(userFixture()),
    };
    const userRepo = { findByEmail: jest.fn().mockResolvedValue(null) };
    const registrationTokenSvc = { findPendingByEmail: jest.fn() };
    const auditSvc = { record: jest.fn().mockResolvedValue({}) };
    return {
      service: new RegistrationService(
        userSvc as unknown as UserService,
        emailSvc as unknown as EmailVerificationService,
        userRepo as unknown as UserRepository,
        registrationTokenSvc as unknown as RegistrationTokenService,
        auditSvc as never,
      ),
      userSvc,
      emailSvc,
      userRepo,
      registrationTokenSvc,
      auditSvc,
    };
  };

  it('normalizes email, hashes the password, stores pending metadata, and returns its challenge DTO', async () => {
    const { service, userSvc, emailSvc, userRepo, auditSvc } = setup();
    await expect(service.register(dto)).resolves.toEqual({
      message: 'Registration pending. Please verify your email address.',
      email: 'person@example.test',
      challenge_id: 'challenge-1',
      method: MfaMethod.EMAIL_OTP,
      expires_at: expires,
    });
    expect(userRepo.findByEmail).toHaveBeenCalledWith('person@example.test');
    expect(userSvc.hashPassword).toHaveBeenCalledWith('Password1!');
    expect(emailSvc.sendRegistrationVerificationEmail).toHaveBeenCalledWith(
      'person@example.test',
      expect.objectContaining(metadata),
    );
    expect(auditSvc.record).toHaveBeenCalledWith({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].REGISTRATION_REQUESTED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'pending',
      actorType: 'anonymous',
      source: 'http',
      metadata: {
        identifier_hash: hashAuditIdentifier('person@example.test'),
      },
    });
  });

  it('rejects duplicate users before hashing or sending email', async () => {
    const { service, userSvc, emailSvc, userRepo } = setup();
    userRepo.findByEmail.mockResolvedValue(userFixture());
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    expect(userSvc.hashPassword).not.toHaveBeenCalled();
    expect(emailSvc.sendRegistrationVerificationEmail).not.toHaveBeenCalled();
  });

  it('resends using the pending token metadata and normalized email', async () => {
    const { service, emailSvc, registrationTokenSvc, auditSvc } = setup();
    const pendingMetadata = { email: 'person@example.test', password: 'hash' };
    registrationTokenSvc.findPendingByEmail.mockResolvedValue({
      metadata: pendingMetadata,
    });
    await expect(
      service.resendRegistration(' Person@Example.TEST '),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'person@example.test',
        challenge_id: 'challenge-1',
      }),
    );
    expect(registrationTokenSvc.findPendingByEmail).toHaveBeenCalledWith(
      'person@example.test',
    );
    expect(emailSvc.sendRegistrationVerificationEmail).toHaveBeenCalledWith(
      'person@example.test',
      pendingMetadata,
    );
    expect(auditSvc.record).toHaveBeenCalledWith({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
          .REGISTRATION_VERIFICATION_RESENT,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'pending',
      actorType: 'anonymous',
      source: 'http',
      metadata: {
        identifier_hash: hashAuditIdentifier('person@example.test'),
      },
    });
  });

  it('rejects resend for an email that already belongs to a user', async () => {
    const { service, emailSvc, userRepo, registrationTokenSvc } = setup();
    userRepo.findByEmail.mockResolvedValue(userFixture());

    await expect(
      service.resendRegistration(' Person@Example.TEST '),
    ).rejects.toThrow(ConflictException);
    expect(registrationTokenSvc.findPendingByEmail).not.toHaveBeenCalled();
    expect(emailSvc.sendRegistrationVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects resend when no pending registration token exists', async () => {
    const { service, emailSvc, registrationTokenSvc } = setup();
    registrationTokenSvc.findPendingByEmail.mockResolvedValue(null);
    await expect(
      service.resendRegistration('person@example.test'),
    ).rejects.toThrow(BadRequestException);
    expect(emailSvc.sendRegistrationVerificationEmail).not.toHaveBeenCalled();
  });

  it('delegates registration verification and returns the created user', async () => {
    const { service, emailSvc, auditSvc } = setup();
    const created = userFixture({ id: 'created-user' });
    emailSvc.verifyRegistrationToken.mockResolvedValue(created);
    await expect(
      service.verifyRegistration('challenge-1', '123456'),
    ).resolves.toBe(created);
    expect(emailSvc.verifyRegistrationToken).toHaveBeenCalledWith(
      'challenge-1',
      '123456',
    );
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event:
          AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
            .REGISTRATION_VERIFICATION_SUCCEEDED,
        subjectId: 'created-user',
      }),
    );
  });
});
