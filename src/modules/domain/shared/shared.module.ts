import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [],
  exports: [TypeOrmModule],
})
export class SharedDomainModule {}
