#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/68a78b5e428f40a6abc3edbcfc0c5467e9dcf2e16fe8552a103abeac5354b988/contract';
import endContract from '../../snapshots/68a78b5e428f40a6abc3edbcfc0c5467e9dcf2e16fe8552a103abeac5354b988/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e6e916145d261bc06db24684433bce16a409065035eaa28ce1eb6238b25badeb/contract';
import startContract from '../../snapshots/e6e916145d261bc06db24684433bce16a409065035eaa28ce1eb6238b25badeb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'userSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'userSession',
        constraint: 'userSession_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userSession',
        index: 'userSession_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userSession',
        index: 'userSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userSession',
        foreignKey: {
          name: 'userSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
