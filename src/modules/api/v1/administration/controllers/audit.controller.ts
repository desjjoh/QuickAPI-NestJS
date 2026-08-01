import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EntityIdParam } from '@/common/decorators/id-param.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { PermissionsGuard } from '@/common/guards/permission.guard';
import { NanoIdParamPipe } from '@/common/pipes/nanoid.pipe';
import {
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';
import { AuditAdministrationService } from '../service/audit.service';
import {
  AuditDetailDto,
  AuditSearchPageDto,
  AuditSearchQueryDto,
} from '../models/audit.model';

@ApiTags('Audit Administration')
@ApiBearerAuth('access-token')
@Controller('audits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditAdministrationController {
  public constructor(private readonly service: AuditAdministrationService) {}

  @Get()
  @ApiOperation({ summary: 'Search audit records' })
  @ApiOkResponse({ type: AuditSearchPageDto })
  @Permissions(PERMISSION_MATRIX[PermissionDomain.AUDIT].SEARCH_AUDIT)
  public search(
    @Query() query: AuditSearchQueryDto,
  ): Promise<AuditSearchPageDto> {
    return this.service.search(query);
  }

  @Get(':id')
  @EntityIdParam
  @ApiOperation({ summary: 'Read an audit record' })
  @ApiOkResponse({ type: AuditDetailDto })
  @Permissions(PERMISSION_MATRIX[PermissionDomain.AUDIT].READ_AUDIT_DETAIL)
  public detail(
    @Param('id', NanoIdParamPipe) id: string,
  ): Promise<AuditDetailDto> {
    return this.service.detail(id);
  }
}
