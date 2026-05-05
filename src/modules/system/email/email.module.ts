import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './services/email.service';
import { postmarkProvider } from './providers/email.provider';

@Module({
  imports: [ConfigModule],
  providers: [postmarkProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
