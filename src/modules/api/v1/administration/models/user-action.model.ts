import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { AdministrationActionDto } from './administration-action.model';

export class UserAdministrationActionDto extends AdministrationActionDto {
  @ApiProperty({
    minimum: 1,
    maximum: 4294967295,
    example: 1,
    description:
      'Version from the last administration user read. Stale actions return 409; reload before retrying.',
  })
  @IsInt()
  @Min(1)
  @Max(4294967295)
  public readonly expected_version!: number;
}
