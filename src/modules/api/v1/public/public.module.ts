import { Module } from '@nestjs/common';
import { LibraryController } from './controllers/library.controller';
import { LibraryModule } from '@/modules/domain/library/library.module';
import { IdentityModule } from '@/modules/domain/identity/identity.module';
import { LibraryService } from './services/library.service';

@Module({
  imports: [LibraryModule, IdentityModule],
  providers: [LibraryService],
  controllers: [LibraryController],
})
export class PublicApiModule {}
