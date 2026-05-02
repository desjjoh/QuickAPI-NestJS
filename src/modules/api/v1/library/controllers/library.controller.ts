import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { BaseCountryDto } from '@/modules/domain/library/models/country.model';
import { BaseGenderDto } from '@/modules/domain/library/models/gender.model';
import { BaseRoleDto } from '@/modules/domain/library/models/role.model';
import { CountryRepository } from '@/modules/domain/library/repositories/country.repository';
import { GenderRepository } from '@/modules/domain/library/repositories/gender.repository';
import { RoleRepository } from '@/modules/domain/library/repositories/role.repository';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Reference Data')
@Controller('')
export class GenderController {
  public constructor(
    private readonly countryRepository: CountryRepository,
    private readonly genderRepository: GenderRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

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
    const countries: CountryEntity[] = await this.countryRepository.findAll();
    return countries.map((e: CountryEntity) => new BaseCountryDto(e));
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
    const genders: GenderEntity[] = await this.genderRepository.findAll();
    return genders.map((e: GenderEntity) => new BaseGenderDto(e));
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
    const roles: RoleEntity[] = await this.roleRepository.findAll();
    return roles.map((role: RoleEntity) => new BaseRoleDto(role));
  }
}
