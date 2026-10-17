import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';
import { AuthenticationApiModule } from './authentication/authentication.module';
import { AdministrationApiModule } from './administration/administration.module';
import { SecurityApiModule } from './security/security.module';
import { PublicApiModule } from './public/public.module';
import { AccountApiModule } from './account/account.module';
import { ArticlesApiModule } from './articles/articles.module';

@Module({
  imports: [
    SecurityApiModule,
    AuthenticationApiModule,
    AccountApiModule,
    AdministrationApiModule,
    PublicApiModule,
    ArticlesApiModule,
  ],
})
export class ApiV1Module {}

export const apiV1Routes: Routes = [
  {
    path: 'v1',
    children: [
      {
        path: 'security',
        module: SecurityApiModule,
      },
      {
        path: 'authentication',
        module: AuthenticationApiModule,
      },
      {
        path: 'account',
        module: AccountApiModule,
      },
      {
        path: 'administration',
        module: AdministrationApiModule,
      },
      {
        path: 'public',
        module: PublicApiModule,
      },
      {
        path: 'articles',
        module: ArticlesApiModule,
      },
    ],
  },
];
