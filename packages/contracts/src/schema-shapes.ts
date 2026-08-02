import { z } from 'zod';

const NoColonId = z.string().min(1).max(120).regex(/^[^:\s]+$/, 'id must not contain ":" or whitespace');

export const SafeTenantIdSchema = NoColonId;
export const SafeItemIdSchema = NoColonId;
