export type AuditMask = 'email' | 'sha256';

export type AuditFieldPolicy =
  | { readonly kind: 'scalar' }
  | { readonly kind: 'masked'; readonly mask: AuditMask }
  | { readonly kind: 'changed-only' }
  | { readonly kind: 'nested-object'; readonly fields: AuditPolicy }
  | { readonly kind: 'relationship-ids'; readonly preserveOrder?: boolean };

export interface AuditPolicy {
  readonly [field: string]: AuditFieldPolicy;
}

export const scalar: AuditFieldPolicy = { kind: 'scalar' };
export const maskedEmail: AuditFieldPolicy = {
  kind: 'masked',
  mask: 'email',
};
export const hashed: AuditFieldPolicy = { kind: 'masked', mask: 'sha256' };
export const changedOnly: AuditFieldPolicy = { kind: 'changed-only' };
export const nestedObject = (fields: AuditPolicy): AuditFieldPolicy => ({
  kind: 'nested-object',
  fields,
});
export const relationshipIds: AuditFieldPolicy = {
  kind: 'relationship-ids',
};

export const orderedRelationshipIds: AuditFieldPolicy = {
  kind: 'relationship-ids',
  preserveOrder: true,
};
