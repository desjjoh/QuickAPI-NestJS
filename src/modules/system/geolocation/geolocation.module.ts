import { Global, Module } from '@nestjs/common';
import { IpLocationService } from './services/ip-location.service';

@Global()
@Module({ providers: [IpLocationService], exports: [IpLocationService] })
export class GeolocationModule {}
