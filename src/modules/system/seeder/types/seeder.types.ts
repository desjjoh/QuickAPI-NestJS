import { EntityManager } from 'typeorm';

export type SeederResult = {
  created: number;
  skipped: number;
};

export interface Seeder {
  readonly name: string;
  readonly order: number;

  run(manager: EntityManager): Promise<SeederResult>;
}
