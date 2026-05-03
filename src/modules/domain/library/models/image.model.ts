import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageEntity } from '../entities/image.entity';
import { WithBaseModel } from '@/common/models/base.model';

export class ImageDto {
  @ApiProperty({
    example: 'https://example.com/public/avatar.png',
    description:
      'Public URL used by clients to load and display the stored image.',
  })
  public readonly url: string;

  @ApiProperty({
    example: 'user-avatars/avatar.png',
    description:
      'Storage provider key used internally to locate, replace, or delete the image file.',
  })
  public readonly storage_key: string;

  @ApiProperty({
    example: 'avatar.png',
    description:
      'Original or generated filename associated with the stored image.',
  })
  public readonly filename: string;

  @ApiProperty({
    example: 'image/png',
    description:
      'MIME type of the stored image, used to describe the file format.',
  })
  public readonly mime_type: string;

  @ApiProperty({
    example: 184_293,
    description: 'Image file size in bytes.',
  })
  public readonly size_bytes: number;

  @ApiProperty({
    example: 512,
    description: 'Image width in pixels.',
  })
  public readonly width: number;

  @ApiProperty({
    example: 512,
    description: 'Image height in pixels.',
  })
  public readonly height: number;

  @ApiPropertyOptional({
    example: 'Profile photo of the user.',
    description:
      'Optional alternative text used to describe the image for accessibility.',
    nullable: true,
  })
  public readonly alt_text: string | null;

  public constructor(image: ImageEntity) {
    this.url = image.url;
    this.storage_key = image.storage_key;
    this.filename = image.filename;
    this.mime_type = image.mime_type;
    this.size_bytes = image.size_bytes;
    this.width = image.width;
    this.height = image.height;
    this.alt_text = image.alt_text ?? null;
  }
}

export class BaseImageDto extends WithBaseModel(ImageDto) {}
