import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';

import { ItemsApiModule } from './items/items.module';
import { AuthenticationApiModule } from './authentication/authentication.module';

@Module({
  imports: [ItemsApiModule],
})
export class ApiV1Module {}

export const apiV1Routes: Routes = [
  {
    path: 'v1',
    children: [
      {
        path: 'items',
        module: ItemsApiModule,
      },
      {
        path: 'authentication',
        module: AuthenticationApiModule,
      },
    ],
  },
];
