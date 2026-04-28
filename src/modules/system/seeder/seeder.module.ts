import { DynamicModule, Module } from '@nestjs/common';
import { Seeder } from './types/seeder.types';
import { SEEDERS } from './tokens/seeder.tokens';
import { SeederService } from './services/seeder.services';

@Module({})
export class SeedingModule {
  public static forFeature(seeders: Seeder[]): DynamicModule {
    return {
      module: SeedingModule,
      providers: [
        {
          provide: SEEDERS,
          useValue: seeders,
        },
        SeederService,
      ],
      exports: [SeederService],
    };
  }
}
