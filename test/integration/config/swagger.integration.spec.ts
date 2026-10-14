import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ApiOkResponse,
  ApiProperty,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import request from 'supertest';

class ReleaseContractDto {
  @ApiProperty({
    example: 'A: B # C',
    description: 'Quoted YAML display value.',
  })
  public readonly message = 'A: B # C';
}

@Controller('release-contract')
class ReleaseContractController {
  @Get()
  @ApiOkResponse({ type: ReleaseContractDto })
  public read(): ReleaseContractDto {
    return new ReleaseContractDto();
  }
}

describe('Swagger serialization with the patched YAML dependency', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReleaseContractController],
    }).compile();
    app = module.createNestApplication();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Release contract')
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves JSON and YAML schemas with the same path and model', async () => {
    const json = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(
      json.body.paths['/release-contract'].get.responses['200'].content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/ReleaseContractDto');
    expect(
      json.body.components.schemas.ReleaseContractDto.properties.message
        .example,
    ).toBe('A: B # C');
    const yaml = await request(app.getHttpServer())
      .get('/docs-yaml')
      .expect(200)
      .expect('Content-Type', /yaml/);
    expect(yaml.text).toContain('/release-contract:');
    expect(yaml.text).toContain('ReleaseContractDto:');
    expect(yaml.text).toContain('A: B # C');
  });
});
