import { PartialType } from '@nestjs/mapped-types';
import { ApiExtraModels } from '@nestjs/swagger';
import { CreateItemDto } from './_create-item.dto';

@ApiExtraModels(CreateItemDto)
export class UpdateItemDto extends PartialType(CreateItemDto) {}
