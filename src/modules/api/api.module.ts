import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { ApiV1Module, apiV1Routes } from './v1/v1.module';
import { ApiV2Module, apiV2Routes } from './v2/v2.module';

@Module({
  imports: [
    ApiV1Module,
    ApiV2Module,

    RouterModule.register([
      { path: 'api', children: [...apiV1Routes, ...apiV2Routes] },
    ]),
  ],
})
export class ApiModule {}
