import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { env } from '@/config/environment.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      expandVariables: true,
    }),
  ],
  providers: [
    {
      provide: 'APP_ENV',
      useValue: env,
    },
  ],
  exports: ['APP_ENV'],
})
export class AppConfigModule {}
