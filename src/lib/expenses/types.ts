export type ExpenseMember = { id: number; name: string; isActive?: boolean; payerEligible?: boolean; participantEligible?: boolean };

export type ExpenseAccess =
  | { kind: "owner"; groupId: number }
  | { kind: "guest"; shareToken: string };

export type ExpenseInput = {
  description: string;
  amount: string;
  paidByMemberId: string;
  participantIds: string[];
  shares?: { memberId: string; amount: string }[];
};

export type ExpenseReview = {
  description: string;
  amount: string;
  payer: ExpenseMember;
  participants: (ExpenseMember & { amount: string })[];
};

export type ExpenseFormState = {
  requestKey?: string;
  savedDestination?: string;
  input?: ExpenseInput;
  review?: ExpenseReview;
  error?: string;
};

export type SavedExpense = {
  id: number;
  description: string;
  amount: string;
  payerName: string;
  createdAt: string;
  participantCount: number;
  splitMethod: string;
  participants: (ExpenseMember & { amount: string })[];
};

/** The only expense data passed across the server/client boundary. */
export type ExpenseFormContext = {
  group: { name: string; currency: string };
  currentMember: ExpenseMember;
  members: ExpenseMember[];
};
