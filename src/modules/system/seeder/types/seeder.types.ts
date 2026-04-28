import { DataSource } from 'typeorm';

export type SeederResult = {
  created: number;
  skipped: number;
};

export interface Seeder {
  readonly name: string;
  readonly order: number;

  run(dataSource: DataSource): Promise<SeederResult>;
}
