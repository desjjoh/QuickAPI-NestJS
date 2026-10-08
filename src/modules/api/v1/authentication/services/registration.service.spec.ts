jest.mock('nanoid', () => ({ customAlphabet: () => () => 'test-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import type { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import type { UserService } from '@/modules/domain/identity/services/user.service';
import type { UserCredentialsService } from '@/modules/domain/identity/services/user-credentials.service';
import { userFixture } from '@/../test/helpers/identity.fixtures';
import type { RegisterDto } from '../models/register.model';
import { RegistrationService } from './registration.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditActorType,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { AuditRedactionService } from '@/modules/domain/audit/services/audit-redaction.service';

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
    const userSvc = {
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    const credentials = {
      hashPassword: jest.fn().mockResolvedValue('hashed'),
    };
    const emailSvc = {
      sendRegistrationVerificationEmail: jest
        .fn()
        .mockResolvedValue({ id: 'challenge-1', expires_at: expires }),
      verifyRegistrationToken: jest.fn().mockResolvedValue(userFixture()),
    };
    const registrationTokenSvc = { findPendingByEmail: jest.fn() };
    const auditSvc = { record: jest.fn().mockResolvedValue({}) };
    return {
      service: new RegistrationService(
        userSvc as unknown as UserService,
        credentials as unknown as UserCredentialsService,
        emailSvc as unknown as EmailVerificationService,
        registrationTokenSvc as unknown as RegistrationTokenService,
        auditSvc as never,
      ),
      userSvc,
      credentials,
      emailSvc,
      registrationTokenSvc,
      auditSvc,
    };
  };

  it('normalizes email, hashes the password, stores pending metadata, and returns its challenge DTO', async () => {
    const { service, userSvc, credentials, emailSvc, auditSvc } = setup();
    await expect(service.register(dto)).resolves.toEqual({
      message: 'Registration pending. Please verify your email address.',
      email: 'person@example.test',
      challenge_id: 'challenge-1',
      method: MfaMethod.EMAIL_OTP,
      expires_at: expires,
    });
    expect(userSvc.findByEmail).toHaveBeenCalledWith('person@example.test');
    expect(credentials.hashPassword).toHaveBeenCalledWith('Password1!');
    expect(emailSvc.sendRegistrationVerificationEmail).toHaveBeenCalledWith(
      'person@example.test',
      expect.objectContaining(metadata),
    );
    expect(auditSvc.record).not.toHaveBeenCalled();
  });

  it('rejects duplicate users before hashing or sending email', async () => {
    const { service, userSvc, credentials, emailSvc } = setup();
    userSvc.findByEmail.mockResolvedValue(userFixture());
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    expect(credentials.hashPassword).not.toHaveBeenCalled();
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
    expect(auditSvc.record).not.toHaveBeenCalled();
  });

  it('rejects resend for an email that already belongs to a user', async () => {
    const { service, emailSvc, userSvc, registrationTokenSvc } = setup();
    userSvc.findByEmail.mockResolvedValue(userFixture());

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
    const tokens = {
      user: { session: { id: 'registration-session' } },
    } as never;
    const issueSession = jest.fn().mockResolvedValue(tokens);
    await expect(
      service.verifyRegistration('challenge-1', '123456', issueSession),
    ).resolves.toBe(tokens);
    expect(emailSvc.verifyRegistrationToken).toHaveBeenCalledWith(
      'challenge-1',
      '123456',
    );
    expect(issueSession).toHaveBeenCalledWith(created);
    expect(auditSvc.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event:
          AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
            .REGISTRATION_VERIFICATION_SUCCEEDED,
        actorType: AuditActorType.USER,
        actorId: 'created-user',
        subjectId: 'created-user',
        sessionId: 'registration-session',
        before: {},
        after: expect.objectContaining({ id: 'created-user' }),
      }),
    );
    const input = auditSvc.record.mock.calls[0][0];
    const diff = new AuditRedactionService().redactDiff(
      input.resourceType,
      input.before,
      input.after,
    );
    expect(diff.before).toEqual({});
    expect(diff.after).not.toHaveProperty('identity.password');
    expect(diff.changes).toEqual(
      expect.objectContaining({ id: { before: null, after: 'created-user' } }),
    );
  });
});
