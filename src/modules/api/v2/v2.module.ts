import { Module } from '@nestjs/common';
import { Routes } from '@nestjs/core';

@Module({
  imports: [],
})
export class ApiV2Module {}

export const apiV2Routes: Routes = [
  {
    path: 'v2',
    children: [],
  },
];
