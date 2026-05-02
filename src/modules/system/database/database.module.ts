import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { typeOrmConfig } from '@/config/database.config';
import { TypeOrmService } from './services/typeorm.service';

@Module({
  imports: [TypeOrmModule.forRootAsync(typeOrmConfig)],
  providers: [TypeOrmService],
  exports: [TypeOrmService],
})
export class DatabaseModule {}
