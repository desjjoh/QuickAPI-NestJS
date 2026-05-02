import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export interface PaginationMetaParameters {
  readonly pageOptions: PaginationOptions;
  readonly itemCount: number;
}

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export type SortOptions = {
  sort: string;
  order: Order;
  label: string;
};

export interface PaginationMetaParameters {
  readonly pageOptions: PaginationOptions;
  readonly itemCount: number;
}

export class PaginationMeta {
  @ApiProperty({
    description: 'Current page number.',
    example: 1,
  })
  public readonly page: number;

  @ApiProperty({
    description: 'Number of items per page.',
    example: 25,
  })
  public readonly take: number;

  @ApiProperty({
    description: 'Total number of items available.',
    example: 200,
  })
  public readonly itemCount: number;

  @ApiProperty({
    description: 'Total number of pages calculated from itemCount and take.',
    example: 8,
  })
  public readonly pageCount: number;

  @ApiProperty({
    description: 'Indicates if there is a previous page.',
    example: true,
  })
  public readonly hasPreviousPage: boolean;

  @ApiProperty({
    description: 'Indicates if there is a next page.',
    example: true,
  })
  public readonly hasNextPage: boolean;

  constructor({ pageOptions, itemCount }: PaginationMetaParameters) {
    this.page = pageOptions.page;
    this.take = pageOptions.take;
    this.itemCount = itemCount;
    this.pageCount = Math.ceil(this.itemCount / this.take);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}

export class PaginationDto<T> {
  @ApiProperty({
    description: 'List of items for the current page.',
    isArray: true,
    example: [],
  })
  @IsArray()
  public readonly data: T[];

  @ApiProperty({
    description: 'Pagination metadata for the response.',
    type: () => PaginationMeta,
  })
  public readonly meta: PaginationMeta;

  constructor(payload: T[], meta: PaginationMeta) {
    this.data = payload;
    this.meta = meta;
  }
}

export class PaginationOptions {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  public readonly search: string = '';

  @ApiPropertyOptional({ enum: Order, default: Order.ASC })
  @IsEnum(Order)
  @IsOptional()
  public readonly order: Order = Order.ASC;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public readonly page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public readonly take: number = 25;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
