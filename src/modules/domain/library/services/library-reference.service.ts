import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { applicationManager } from '@/common/helpers/transaction.helper';
import { CountryRepository } from '../repositories/country.repository';
import { TimezoneRepository } from '../repositories/time-zone.repository';
import { RegionRepository } from '../repositories/region.repository';

@Injectable()
export class LibraryReferenceService {
  public constructor(
    private readonly countryRepo: CountryRepository,
    private readonly timezoneRepo: TimezoneRepository,
    private readonly regionRepo: RegionRepository,
  ) {}

  public getCountries(
    manager: EntityManager = applicationManager(this.countryRepo.manager),
  ) {
    return this.countryRepo.findAll(manager);
  }

  public getTimezones(
    manager: EntityManager = applicationManager(this.timezoneRepo.manager),
  ) {
    return this.timezoneRepo.findAll(manager);
  }

  public getRegions(
    manager: EntityManager = applicationManager(this.regionRepo.manager),
  ) {
    return this.regionRepo.findAll(manager);
  }

  public findByIdAndCountry(
    manager: EntityManager,
    id: string,
    countryId: string,
  ) {
    return this.regionRepo.findByIdAndCountry(manager, id, countryId);
  }
}
