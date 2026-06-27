import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { BaseGenderDto } from '@/modules/domain/library/models/gender.model';
import { BaseRoleDto } from '@/modules/domain/library/models/role.model';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { LibraryService } from '../services/library.service';
import { BaseAccountStatusDto } from '@/modules/domain/library/models/status.model';
import { BaseTimezoneDto } from '@/modules/domain/library/models/time-zone.model';

@ApiTags('Reference Data')
@Controller('')
export class GenderController {
  public constructor(private readonly svc: LibraryService) {}

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

  // GET /roles
  @Get('roles')
  @ApiOperation({
    summary: 'List roles',
    description:
      'Returns role reference data used by administration screens and access-management forms.',
  })
  @ApiOkResponse({
    description: 'Role reference data returned successfully.',
    type: [BaseRoleDto],
  })
  public async getRoles(): Promise<BaseRoleDto[]> {
    return this.svc.getRoles();
  }

  // GET /statuses
  @Get('statuses')
  @ApiOperation({
    summary: 'List account statuses',
    description:
      'Returns account status reference data used by administration screens and account lifecycle management views.',
  })
  @ApiOkResponse({
    description: 'Account status reference data returned successfully.',
    type: [BaseAccountStatusDto],
  })
  public async getStatuses(): Promise<BaseAccountStatusDto[]> {
    return this.svc.getAccountStatuses();
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
