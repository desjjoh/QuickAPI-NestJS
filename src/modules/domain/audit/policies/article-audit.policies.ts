import { AuditResourceType } from '@/config/audit-events.config';

import {
  AuditPolicy,
  changedOnly,
  nestedObject,
  scalar,
} from '../types/audit-policy.types';

export const ARTICLE_AUDIT_POLICIES: Readonly<Record<string, AuditPolicy>> = {
  [AuditResourceType.ARTICLES_ARTICLE]: {
    id: scalar,
    version: scalar,
    content: nestedObject({
      title: scalar,
      summary: scalar,
      body: changedOnly,
    }),
    media: nestedObject({ hero_id: scalar }),
    attribution: nestedObject({ author_id: scalar }),
    publication: nestedObject({
      status: nestedObject({ id: scalar, key: scalar }),
      publisher_id: scalar,
      published_at: scalar,
    }),
    created_at: scalar,
    updated_at: scalar,
  },
};
