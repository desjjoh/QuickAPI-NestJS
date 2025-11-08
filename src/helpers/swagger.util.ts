import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const CONFIG = new DocumentBuilder()
  .setTitle('Nest API Example')
  .setDescription(
    'Minimal NestJS QuickAPI with validated environment config, structured logging, and DTO validation.',
  )
  .setVersion('1.0.0')
  .addBearerAuth(
    {
      description: 'Default JWT Authorization',
      type: 'http',
      in: 'header',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'access-token',
  )
  .build();

export class Swagger {
  public static init(app: INestApplication, prefix: string): void {
    const document = SwaggerModule.createDocument(app, CONFIG);
    SwaggerModule.setup(`/${prefix}`, app, document);
  }
}
