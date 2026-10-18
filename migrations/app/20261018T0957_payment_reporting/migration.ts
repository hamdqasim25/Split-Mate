#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6164bc09235f61a5ae59c7e5d465734a240c6fc0c9f4d8da37a3c1d986e3dbde/contract';
import endContract from '../../snapshots/6164bc09235f61a5ae59c7e5d465734a240c6fc0c9f4d8da37a3c1d986e3dbde/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/68a78b5e428f40a6abc3edbcfc0c5467e9dcf2e16fe8552a103abeac5354b988/contract';
import startContract from '../../snapshots/68a78b5e428f40a6abc3edbcfc0c5467e9dcf2e16fe8552a103abeac5354b988/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('creationKind', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('recordedByMemberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('requestKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('reviewedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('reviewedByMemberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'payment',
        constraint: 'payment_requestKey_key',
        columns: ['requestKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment',
        index: 'payment_recordedByMemberId_idx_bb82e2f1',
        columns: ['recordedByMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment',
        index: 'payment_reviewedByMemberId_idx_60d9da7b',
        columns: ['reviewedByMemberId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment',
        foreignKey: {
          name: 'payment_recordedByMemberId_fkey',
          columns: ['recordedByMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment',
        foreignKey: {
          name: 'payment_reviewedByMemberId_fkey',
          columns: ['reviewedByMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
