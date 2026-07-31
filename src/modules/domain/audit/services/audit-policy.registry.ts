import { Injectable, Optional } from '@nestjs/common';

import { AuditPolicy } from '../types/audit-policy.types';
import { IDENTITY_AUDIT_POLICIES } from '../policies/identity-audit.policies';
import { MEDIA_AUDIT_POLICIES } from '../policies/media-audit.policies';

@Injectable()
export class AuditPolicyRegistry {
  private readonly policies = new Map<string, AuditPolicy>();

  public constructor(@Optional() includeDefaults = true) {
    if (includeDefaults) {
      this.registerAll(IDENTITY_AUDIT_POLICIES);
      this.registerAll(MEDIA_AUDIT_POLICIES);
    }
  }

  public register(resourceType: string, policy: AuditPolicy): void {
    if (this.policies.has(resourceType))
      throw new Error(`Audit policy already registered: ${resourceType}`);
    this.policies.set(resourceType, policy);
  }

  public registerAll(policies: Readonly<Record<string, AuditPolicy>>): void {
    for (const [resourceType, policy] of Object.entries(policies))
      this.register(resourceType, policy);
  }

  public get(resourceType: string): AuditPolicy | undefined {
    return this.policies.get(resourceType);
  }

  public has(resourceType: string): boolean {
    return this.policies.has(resourceType);
  }
}
