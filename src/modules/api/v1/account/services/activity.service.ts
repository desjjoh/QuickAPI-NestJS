import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditQueryService } from '@/modules/domain/audit/services/audit-query.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  AccountActivityEventDto,
  AccountActivityPageDto,
  AccountActivityQueryDto,
} from '../models/activity.model';

type ActivityCursor = { occurredAt: Date; id: string };

@Injectable()
export class ActivityApiService {
  public constructor(private readonly auditQueries: AuditQueryService) {}

  public async findForUser(
    user: UserEntity,
    query: AccountActivityQueryDto,
  ): Promise<AccountActivityPageDto> {
    if (
      query.occurredFrom &&
      query.occurredTo &&
      query.occurredFrom > query.occurredTo
    )
      throw new BadRequestException('occurredFrom must not follow occurredTo');

    const result = await this.auditQueries.actorActivity(
      'user',
      user.id,
      {
        domain: query.domain,
        event: query.event,
        outcome: query.outcome,
        occurredFrom: query.occurredFrom,
        occurredTo: query.occurredTo,
      },
      this.decodeCursor(query.cursor),
      query.take,
    );
    const data = result.events.map(
      (event) => new AccountActivityEventDto(event),
    );
    const last = result.events.at(-1);
    return new AccountActivityPageDto(
      data,
      result.hasMore && last
        ? this.encodeCursor({ occurredAt: last.occurredAt, id: last.id })
        : null,
    );
  }

  private decodeCursor(value: string | undefined): ActivityCursor | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as {
        occurredAt?: unknown;
        id?: unknown;
      };
      const occurredAt = new Date(String(parsed.occurredAt));
      if (
        typeof parsed.id !== 'string' ||
        parsed.id.length !== 16 ||
        Number.isNaN(occurredAt.getTime())
      )
        throw new Error('invalid cursor');
      return { occurredAt, id: parsed.id };
    } catch {
      throw new BadRequestException('cursor is invalid');
    }
  }

  private encodeCursor(cursor: ActivityCursor): string {
    return Buffer.from(
      JSON.stringify({
        occurredAt: cursor.occurredAt.toISOString(),
        id: cursor.id,
      }),
    ).toString('base64url');
  }
}
