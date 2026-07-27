import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserAdministrationDto {
  @ApiPropertyOptional({ description: 'Account status reference ID.' })
  @IsOptional()
  @IsString()
  @Length(16, 16)
  public readonly status_id?: string;

  @ApiPropertyOptional({
    description: 'Complete replacement set of role reference IDs.',
    type: String,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(16, 16, { each: true })
  public readonly role_ids?: string[];
}
