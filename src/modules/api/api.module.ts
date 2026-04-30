import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { ApiV1Module, apiV1Routes } from './v1/v1.module';

@Module({
  imports: [
    ApiV1Module,

    RouterModule.register([
      {
        path: 'api',
        children: [...apiV1Routes],
      },
    ]),
  ],
})
export class ApiModule {}
