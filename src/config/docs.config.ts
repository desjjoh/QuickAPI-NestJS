import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { env } from '@/config/environment.config';

export class SwaggerConfig {
  static setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle(env.APP_NAME)
      .setDescription(`${env.APP_NAME} API documentation`)
      .setVersion(env.APP_VERSION)
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
      .build();

    const document: OpenAPIObject = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
    });

    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: `${env.APP_NAME} Docs`,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    app.getHttpAdapter().get('/docs-json', (_req, res) => {
      res.json(document);
    });
  }
}
