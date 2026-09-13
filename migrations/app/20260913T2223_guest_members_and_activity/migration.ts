#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/de17766a725a670b42df86f7142a60b95c6946cce46e15d531123a249cebc2e2/contract';
import startContract from '../../snapshots/de17766a725a670b42df86f7142a60b95c6946cce46e15d531123a249cebc2e2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e6e916145d261bc06db24684433bce16a409065035eaa28ce1eb6238b25badeb/contract';
import endContract from '../../snapshots/e6e916145d261bc06db24684433bce16a409065035eaa28ce1eb6238b25badeb/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  placeholder,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'expense',
        constraint: 'expense_paidBy_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'expense', index: 'expense_paidBy_idx_c34eb888' }),
      this.dropColumn({ schema: 'public', table: 'expense', column: 'paidBy' }),
      this.dropConstraint({
        schema: 'public',
        table: 'expenseParticipant',
        constraint: 'expenseParticipant_userId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_userId_idx_a489d58a',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'expenseParticipant',
        constraint: 'expenseParticipant_expenseId_userId_key',
      }),
      this.dropColumn({ schema: 'public', table: 'expenseParticipant', column: 'userId' }),
      this.dropColumn({ schema: 'public', table: 'groupMember', column: 'joinedAt' }),
      this.dropConstraint({
        schema: 'public',
        table: 'groupMember',
        constraint: 'groupMember_groupId_userId_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'payment',
        constraint: 'payment_payerId_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'payment',
        constraint: 'payment_receiverId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({ schema: 'public', table: 'payment', index: 'payment_payerId_idx_3d3ae95d' }),
      this.dropColumn({ schema: 'public', table: 'payment', column: 'payerId' }),
      this.dropIndex({
        schema: 'public',
        table: 'payment',
        index: 'payment_receiverId_idx_fe124f44',
      }),
      this.dropColumn({ schema: 'public', table: 'payment', column: 'receiverId' }),
      this.createTable({
        schema: 'public',
        table: 'activityEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('entityType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('groupId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('memberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'guestSession',
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
          col('groupMemberId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'group',
        column: col('shareLinkEnabled', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'groupMember',
        column: col('addedAt', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'groupMember',
        column: col('claimedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'groupMember',
        column: col('isActive', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'groupMember',
        column: col('lastActiveAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'expense',
        column: col('paidByMemberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-expense-paidByMemberId', {
        check: () => placeholder('backfill-expense-paidByMemberId:check'),
        run: () => placeholder('backfill-expense-paidByMemberId:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'expense', column: 'paidByMemberId' }),
      this.addColumn({
        schema: 'public',
        table: 'expenseParticipant',
        column: col('memberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-expenseParticipant-memberId', {
        check: () => placeholder('backfill-expenseParticipant-memberId:check'),
        run: () => placeholder('backfill-expenseParticipant-memberId:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'expenseParticipant', column: 'memberId' }),
      this.addColumn({
        schema: 'public',
        table: 'group',
        column: col('shareToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-group-shareToken', {
        check: () => placeholder('backfill-group-shareToken:check'),
        run: () => placeholder('backfill-group-shareToken:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'group', column: 'shareToken' }),
      this.addColumn({
        schema: 'public',
        table: 'groupMember',
        column: col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-groupMember-name', {
        check: () => placeholder('backfill-groupMember-name:check'),
        run: () => placeholder('backfill-groupMember-name:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'groupMember', column: 'name' }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('payerMemberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-payment-payerMemberId', {
        check: () => placeholder('backfill-payment-payerMemberId:check'),
        run: () => placeholder('backfill-payment-payerMemberId:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'payment', column: 'payerMemberId' }),
      this.addColumn({
        schema: 'public',
        table: 'payment',
        column: col('receiverMemberId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-payment-receiverMemberId', {
        check: () => placeholder('backfill-payment-receiverMemberId:check'),
        run: () => placeholder('backfill-payment-receiverMemberId:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'payment', column: 'receiverMemberId' }),
      this.dropNotNull({ schema: 'public', table: 'groupMember', column: 'userId' }),
      this.addUnique({
        schema: 'public',
        table: 'expenseParticipant',
        constraint: 'expenseParticipant_expenseId_memberId_key',
        columns: ['expenseId', 'memberId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'group',
        constraint: 'group_shareToken_key',
        columns: ['shareToken'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'guestSession',
        constraint: 'guestSession_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'activityEvent',
        index: 'activityEvent_groupId_createdAt_idx_bac1e421',
        columns: ['groupId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'activityEvent',
        index: 'activityEvent_groupId_idx_e2fb5578',
        columns: ['groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'activityEvent',
        index: 'activityEvent_memberId_idx_76b3c263',
        columns: ['memberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_paidByMemberId_idx_e98587e6',
        columns: ['paidByMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_memberId_idx_76b3c263',
        columns: ['memberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guestSession',
        index: 'guestSession_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guestSession',
        index: 'guestSession_groupMemberId_idx_0cf1f04e',
        columns: ['groupMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment',
        index: 'payment_payerMemberId_idx_c9a3134e',
        columns: ['payerMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment',
        index: 'payment_receiverMemberId_idx_0e68368d',
        columns: ['receiverMemberId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'activityEvent',
        foreignKey: {
          name: 'activityEvent_groupId_fkey',
          columns: ['groupId'],
          references: { schema: 'public', table: 'group', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'activityEvent',
        foreignKey: {
          name: 'activityEvent_memberId_fkey',
          columns: ['memberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense',
        foreignKey: {
          name: 'expense_paidByMemberId_fkey',
          columns: ['paidByMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseParticipant',
        foreignKey: {
          name: 'expenseParticipant_memberId_fkey',
          columns: ['memberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guestSession',
        foreignKey: {
          name: 'guestSession_groupMemberId_fkey',
          columns: ['groupMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment',
        foreignKey: {
          name: 'payment_payerMemberId_fkey',
          columns: ['payerMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment',
        foreignKey: {
          name: 'payment_receiverMemberId_fkey',
          columns: ['receiverMemberId'],
          references: { schema: 'public', table: 'groupMember', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
