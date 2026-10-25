#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6164bc09235f61a5ae59c7e5d465734a240c6fc0c9f4d8da37a3c1d986e3dbde/contract';
import startContract from '../../snapshots/6164bc09235f61a5ae59c7e5d465734a240c6fc0c9f4d8da37a3c1d986e3dbde/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fac998bb7eb1661f1c59582e8485caee9e1a9532fece05aaa8a55d3a075a44c4/contract';
import endContract from '../../snapshots/fac998bb7eb1661f1c59582e8485caee9e1a9532fece05aaa8a55d3a075a44c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'paymentAllocation',
        columns: [
          col('amountPence', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('expenseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('paymentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'expense',
        column: col('deletedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'paymentAllocation',
        constraint: 'paymentAllocation_paymentId_expenseId_key',
        columns: ['paymentId', 'expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'paymentAllocation',
        index: 'paymentAllocation_expenseId_idx_69d413fa',
        columns: ['expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'paymentAllocation',
        index: 'paymentAllocation_paymentId_idx_b2fe9a10',
        columns: ['paymentId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'paymentAllocation',
        foreignKey: {
          name: 'paymentAllocation_paymentId_fkey',
          columns: ['paymentId'],
          references: { schema: 'public', table: 'payment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'paymentAllocation',
        foreignKey: {
          name: 'paymentAllocation_expenseId_fkey',
          columns: ['expenseId'],
          references: { schema: 'public', table: 'expense', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
