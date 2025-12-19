import { Injectable } from '@nestjs/common';
import { RootResponseDto } from '../models';

@Injectable()
export class AppService {
  public get_root(message: string): RootResponseDto {
    return new RootResponseDto(message);
  }
}
