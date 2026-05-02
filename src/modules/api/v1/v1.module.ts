import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';
import { AuthenticationApiModule } from './authentication/authentication.module';
import { AdministrationApiModule } from './administration/administration.module';
import { SecurityApiModule } from './security/security.module';
import { LibraryApiModule } from './library/library.module';

@Module({
  imports: [
    SecurityApiModule,
    AuthenticationApiModule,
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
        path: 'administration',
        module: AdministrationApiModule,
      },
      {
        path: 'authentication',
        module: AuthenticationApiModule,
      },
      {
        path: 'library',
        module: LibraryApiModule,
      },
      {
        path: 'security',
        module: SecurityApiModule,
      },
    ],
  },
];
