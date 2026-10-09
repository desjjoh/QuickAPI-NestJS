import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Shared precondition for article edits and lifecycle requests. */
export class ArticleVersionDto {
  @ApiProperty({
    minimum: 1,
    maximum: 4294967295,
    example: 1,
    description:
      'Version returned by the last creator or administration read. Stale versions return 409; reload before retrying. Multipart accepts decimal digit strings.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(4294967295)
  public readonly expected_version!: number;
}
