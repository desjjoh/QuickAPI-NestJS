import { Module } from '@nestjs/common';
import { GenderController } from './controllers/library.controller';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { LibraryService } from './services/library.service';

@Module({
  imports: [LibraryModule],
  providers: [LibraryService],
  controllers: [GenderController],
})
export class LibraryApiModule {}
