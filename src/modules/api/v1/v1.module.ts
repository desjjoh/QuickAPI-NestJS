import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';
import { AuthenticationApiModule } from './authentication/authentication.module';
import { AdministrationApiModule } from './administration/administration.module';
import { SecurityApiModule } from './security/security.module';
import { LibraryApiModule } from './library/library.module';
import { AccountApiModule } from './account/account.module';

@Module({
  imports: [
    SecurityApiModule,
    AuthenticationApiModule,
    AccountApiModule,
    AdministrationApiModule,
    LibraryApiModule,
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
        path: 'library',
        module: LibraryApiModule,
      },
    ],
  },
];
