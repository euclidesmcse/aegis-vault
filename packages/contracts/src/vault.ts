import { z } from 'zod';
import { SafeItemIdSchema, SafeTenantIdSchema } from './schema-shapes.js';

export const VaultItemTypeSchema = z.enum(['login', 'note', 'identity', 'card', 'custom']);
export type VaultItemType = z.infer<typeof VaultItemTypeSchema>;

export const VaultItemEnvelopeSchema = z.object({
  v: z.literal(1),
  alg: z.literal('XCHACHA20-POLY1305-IETF'),
  kdf: z.literal('argon2id'),
  params: z.object({ t: z.number().int().positive(), m: z.number().int().positive(), p: z.number().int().positive() }),
  salt: z.string().min(1),
  nonce: z.string().min(1),
  aad: z.string().min(1),
  ct: z.string().min(1),
});
export type VaultItemEnvelope = z.infer<typeof VaultItemEnvelopeSchema>;

export const VaultItemMinimalSchema = z.object({
  id: SafeItemIdSchema,
  type: VaultItemTypeSchema,
  folderId: SafeItemIdSchema.nullable(),
  collectionId: SafeItemIdSchema.nullable(),
  favorite: z.boolean(),
  trashed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().min(0),
});
export type VaultItemMinimal = z.infer<typeof VaultItemMinimalSchema>;

export const CreateVaultItemRequestSchema = VaultItemMinimalSchema.partial({
  id: true,
  createdAt: true,
  updatedAt: true,
  revision: true,
}).extend({
  type: VaultItemTypeSchema,
  envelope: VaultItemEnvelopeSchema,
  classification: z.enum(['owner', 'member', 'shared', 'auditor']).default('owner'),
});
export type CreateVaultItemRequest = z.infer<typeof CreateVaultItemRequestSchema>;

export const FolderSchema = z.object({
  id: SafeItemIdSchema,
  parentId: SafeItemIdSchema.nullable(),
  name: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Folder = z.infer<typeof FolderSchema>;

export const CollectionSchema = z.object({
  id: SafeItemIdSchema,
  workspaceId: SafeTenantIdSchema,
  name: z.string().min(1).max(120),
  envelopeForMember: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Collection = z.infer<typeof CollectionSchema>;
