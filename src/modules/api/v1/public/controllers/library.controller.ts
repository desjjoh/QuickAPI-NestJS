import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { BaseGenderDto } from '@/modules/domain/identity/models/gender.model';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { LibraryService } from '../services/library.service';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';
import { throttlePolicies } from '@/config/throttle-policy.config';
import { Throttle } from '@nestjs/throttler';
import { LibraryStartupDto } from '../models/library-startup.model';

@ApiTags('Public Library')
@Controller('library')
@Throttle({ default: throttlePolicies.publicRead })
export class LibraryController {
  public constructor(private readonly svc: LibraryService) {}

  @Get('startup')
  @ApiOperation({
    summary: 'Get portal startup reference data',
    description: 'Returns countries, genders, and time zones in one response.',
  })
  @ApiOkResponse({
    description: 'Portal startup reference data returned successfully.',
    type: LibraryStartupDto,
  })
  public async getStartup(): Promise<LibraryStartupDto> {
    return this.svc.getStartup();
  }

  // GET /countries
  @Get('countries')
  @ApiOperation({
    summary: 'List countries',
    description:
      'Returns public country reference data used by registration, profile, address, and phone number forms.',
  })
  @ApiOkResponse({
    description: 'Country reference data returned successfully.',
    type: [BaseCountryDto],
  })
  public async getCountries(): Promise<BaseCountryDto[]> {
    return this.svc.getCountries();
  }

  // GET /genders
  @Get('genders')
  @ApiOperation({
    summary: 'List genders',
    description:
      'Returns public gender reference data used by registration and profile forms.',
  })
  @ApiOkResponse({
    description: 'Gender reference data returned successfully.',
    type: [BaseGenderDto],
  })
  public async getGenders(): Promise<BaseGenderDto[]> {
    return this.svc.getGenders();
  }

  // GET /timezones
  @Get('timezones')
  @ApiOperation({
    summary: 'List time zones',
    description:
      'Returns public IANA time zone reference data used by registration and profile region forms.',
  })
  @ApiOkResponse({
    description: 'Time zone reference data returned successfully.',
    type: [BaseTimezoneDto],
  })
  public async getTimezones(): Promise<BaseTimezoneDto[]> {
    return this.svc.getTimezones();
  }
}
