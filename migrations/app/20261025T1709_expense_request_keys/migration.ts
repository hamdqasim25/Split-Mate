#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/dfd283667c844905489cdf3e034958389cc0af92b12d02e338a546205b9dda0d/contract';
import endContract from '../../snapshots/dfd283667c844905489cdf3e034958389cc0af92b12d02e338a546205b9dda0d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fac998bb7eb1661f1c59582e8485caee9e1a9532fece05aaa8a55d3a075a44c4/contract';
import startContract from '../../snapshots/fac998bb7eb1661f1c59582e8485caee9e1a9532fece05aaa8a55d3a075a44c4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'expense',
        column: col('creationDetails', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expense',
        column: col('requestKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'expense',
        constraint: 'expense_requestKey_key',
        columns: ['requestKey'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
