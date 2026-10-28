import { DynamicModule, Module } from '@nestjs/common';
import { Seeder } from './types/seeder.types';
import { SEEDERS, SEEDER_GROUP } from './tokens/seeder.tokens';
import { SeederService } from './services/seeder.services';

@Module({})
export class SeedingModule {
  public static forFeature(group: string, seeders: Seeder[]): DynamicModule {
    return {
      module: SeedingModule,
      providers: [
        { provide: SEEDER_GROUP, useValue: group },
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
