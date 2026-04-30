import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';
import { AuthenticationApiModule } from './authentication/authentication.module';
import { AdministrationApiModule } from './administration/administration.module';

@Module({
  imports: [AuthenticationApiModule, AdministrationApiModule],
})
export class ApiV1Module {}

export const apiV1Routes: Routes = [
  {
    path: 'v1',
    children: [
      {
        path: 'authentication',
        module: AuthenticationApiModule,
      },
      {
        path: 'administration',
        module: AdministrationApiModule,
      },
    ],
  },
];
