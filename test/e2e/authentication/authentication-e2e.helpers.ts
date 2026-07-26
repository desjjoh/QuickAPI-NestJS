import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { EmailService } from '@/modules/system/email/services/email.service';
import type { SendEmailOptions } from '@/modules/system/email/types/options.types';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import { setupTestSuite, type TestSuite } from '../../helpers/test-app';

const SECURITY_ROOT = '/api/v1/security';
export const REGISTRATION_ROOT = '/api/v1/authentication/registration';

export type CapturedEmail = {
  to: string;
  templateKey: string;
  subject: string;
  tag: string;
  model: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, string>>;
};

/** Captures the pre-rendered email contract, so tests never scrape HTML. */
export class CapturingEmailService {
  public readonly messages: CapturedEmail[] = [];

  public async sendEmail<TModel extends Record<string, unknown>>(
    options: SendEmailOptions<TModel>,
  ): Promise<void> {
    this.messages.push({
      to: options.to,
      templateKey: options.template.key,
      subject: options.template.subject,
      tag: options.tag ?? options.template.tag,
      model: Object.freeze({ ...(options.model ?? {}) }),
      metadata: Object.freeze({ ...(options.metadata ?? {}) }),
    });
  }

  public verificationCodeFor(challengeId: string): string {
    const message = [...this.messages]
      .reverse()
      .find(
        (candidate) =>
          candidate.templateKey === 'registration-verification' &&
          candidate.metadata.tokenId === challengeId,
      );
    const code = message?.model.mfaCode;
    if (typeof code !== 'string')
      throw new Error('No structured verification message was captured.');
    return code;
  }

  public clear(): void {
    this.messages.length = 0;
  }
}

export async function setupAuthenticationSuite(): Promise<{
  suite: TestSuite;
  email: CapturingEmailService;
}> {
  const email = new CapturingEmailService();
  const suite = await setupTestSuite((builder) =>
    builder
      .overrideProvider(EmailService)
      .useValue(email)
      .overrideProvider(getOptionsToken())
      .useValue({
        skipIf: () => true,
        throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
      }),
  );
  return { suite, email };
}

export async function acquireCsrf(
  agent: ReturnType<typeof request.agent>,
): Promise<string> {
  const response = await agent.get(`${SECURITY_ROOT}/csrf`).expect(200);
  expect(response.body).toEqual({
    token: expect.any(String),
    iat: expect.any(Number),
    exp: expect.any(Number),
  });
  expect(response.headers['set-cookie']).toBeDefined();
  return response.body.token as string;
}

export async function registrationPayload(dataSource: DataSource) {
  const [gender, country, timezone] = await Promise.all([
    dataSource
      .getRepository(GenderEntity)
      .findOneByOrFail({ key: 'prefer_not_to_say' }),
    dataSource.getRepository(CountryEntity).findOneByOrFail({ iso2: 'CA' }),
    dataSource
      .getRepository(TimezoneEntity)
      .findOneByOrFail({ key: 'America/Toronto' }),
  ]);

  return {
    email: 'Person@Example.Test',
    password: 'Valid!Pass1',
    first_name: 'Pat',
    last_name: 'Person',
    dob: '1990-01-02',
    gender_id: gender.id,
    country_id: country.id,
    timezone_id: timezone.id,
  };
}

export async function requestRegistration(
  app: INestApplication,
  dataSource: DataSource,
) {
  const agent = request.agent(app.getHttpServer());
  const csrf = await acquireCsrf(agent);
  const payload = await registrationPayload(dataSource);
  const response = await agent
    .post(`${REGISTRATION_ROOT}/request`)
    .set('x-csrf-token', csrf)
    .send(payload)
    .expect(201);
  return { agent, csrf, payload, response };
}
