import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaymentReconciliation, PaymentError } from "@/data/payments";
import { reconcilePaymentAction } from "@/app/actions/payments";
import PaymentReconciliationForm from "@/components/groups/payment-reconciliation-form";

export const metadata = { title: "Reconcile payment | SPLITMate" };
export default async function ReconcilePage({ params }: { params: Promise<{ groupId: string; paymentId: string }> }) {
  if (!await getCurrentUser()) redirect("/login?next=/dashboard");
  const { groupId, paymentId } = await params;
  if (![groupId, paymentId].every(id => /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2_147_483_647)) notFound();
  let data;
  try { data = await getPaymentReconciliation(Number(groupId), Number(paymentId)); }
  catch (error) {
    if (error instanceof PaymentError) notFound();
    console.error("Payment reconciliation loading failed unexpectedly.");
    return <main className="p-6 text-foreground"><h1>Payment reconciliation unavailable</h1><p>Refresh and try again.</p></main>;
  }
  return <main className="min-h-screen bg-canvas px-4 py-8 text-foreground"><div className="mx-auto max-w-2xl">
    <Link href={`/groups/${groupId}`} className="inline-flex min-h-11 items-center text-accent">Back to group / cancel</Link>
    <h1 className="mt-4 text-2xl font-semibold">Reconcile payment expenses</h1>
    <p className="mt-3 break-words">{data.payment.payerName} to {data.payment.receiverName} — £{data.payment.amount}</p>
    <PaymentReconciliationForm key={data.payment.allocationVersion} payment={data.payment} expenses={data.expenses} action={reconcilePaymentAction.bind(null, Number(groupId), Number(paymentId), data.payment.allocationVersion!)} />
  </div></main>;
}
