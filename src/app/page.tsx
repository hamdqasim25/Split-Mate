import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/app/actions/auth";

const steps = [
  {
    number: "01",
    title: "Create a group",
    description:
      "Bring your flatmates, travel buddies, or dinner crew together. Give every shared adventure a home.",
  },
  {
    number: "02",
    title: "Add expenses",
    description:
      "Record what was paid, who paid it, and who is sharing the cost. Keep the little things accounted for.",
  },
  {
    number: "03",
    title: "Track payments",
    description:
      "See who owes what at a glance, and keep track as everyone settles up. No awkward calculations.",
  },
];

const expenses = [
  {
    initial: "S",
    title: "Somewhere to stay",
    detail: "You paid · Split equally",
    amount: "£120.00",
  },
  {
    initial: "D",
    title: "Dinner together",
    detail: "Yamin paid · Split equally",
    amount: "£75.00",
  },
  {
    initial: "T",
    title: "Train tickets",
    detail: "Mohammed paid · Split equally",
    amount: "£45.00",
  },
];

const primaryLink =
  "inline-flex items-center justify-center gap-3 rounded-full bg-emerald-800 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-900 active:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

const secondaryButton =
  "inline-flex cursor-pointer items-center justify-center rounded-full border border-accent/30 bg-surface px-6 py-3.5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent-soft active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export default async function Home() {
  const user = await getCurrentUser();
  const authenticated = Boolean(user);
  const destination = authenticated ? "/dashboard" : "/register";

  return (
    <main className="min-h-screen bg-canvas font-sans text-foreground">
      <header className="border-b border-line/10">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5"
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-xl bg-emerald-800 text-2xl text-white"
            >
              ÷
            </span>

            <span>
              SPLIT<span className="text-accent">Mate</span>
            </span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#how-it-works"
              className="hidden text-sm font-medium text-muted hover:text-accent sm:block"
            >
              How it works
            </a>

            {authenticated ? (
              <>
                <Link href="/dashboard" className={primaryLink}>
                  Dashboard
                  <span aria-hidden="true">↗</span>
                </Link>

                <form action={signOut}>
                  <button type="submit" className={secondaryButton}>
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Log in
                </Link>

                <Link href="/register" className={primaryLink}>
                  Create account
                  <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent-soft px-3.5 py-2 text-xs font-semibold text-accent">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-700"
            />
            Shared costs, made simple
          </p>

          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Split expenses.
            <span className="mt-2 block text-accent">
              Keep friendships simple.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-8 text-muted">
            Weekend trips. Shared bills. One more round. Keep group expenses
            organised and see who owes what with SPLITMate.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href={destination} className={primaryLink}>
              {authenticated ? "Go to dashboard" : "Get started"}
              <span aria-hidden="true">→</span>
            </Link>

            <a
              href="#how-it-works"
              className="text-sm font-semibold text-muted underline decoration-slate-300 underline-offset-4 hover:text-accent"
            >
              See how it works
            </a>
          </div>

          <p className="mt-7 text-xs font-medium tracking-wide text-muted">
            Less chasing payments. More making plans.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[2.5rem] bg-accent-soft/60 sm:-inset-5 sm:rotate-2"
          />

          <div className="relative rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Your group
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Weekend trip
                </h2>

                <p className="mt-1 text-sm text-muted">
                  You, Yamin, and Mohammed
                </p>
              </div>

              <span className="rounded-full bg-subtle px-3 py-1 text-xs font-medium text-muted">
                Example
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-900 p-5 text-white">
              <p className="text-sm text-emerald-100">
                Total group expenses
              </p>

              <p className="mt-2 text-4xl font-semibold tracking-tight">
                £240
                <span className="text-2xl text-emerald-200">.00</span>
              </p>

              <p className="mt-3 text-xs text-emerald-100">
                3 expenses · 3 friends · All in one place
              </p>
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
              Recent expenses
            </h3>

            <ul className="mt-2 divide-y divide-slate-100">
              {expenses.map((expense) => (
                <li
                  key={expense.title}
                  className="flex items-center gap-3 py-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-xs font-bold text-muted"
                  >
                    {expense.initial}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{expense.title}</p>

                    <p className="mt-0.5 text-xs text-muted">
                      {expense.detail}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {expense.amount}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-muted">Your share</dt>
                <dd className="mt-1 font-semibold">£80.00</dd>
              </div>

              <div className="text-right">
                <dt className="text-muted">You paid</dt>
                <dd className="mt-1 font-semibold">£120.00</dd>
              </div>

              <div className="col-span-2 flex items-center justify-between rounded-xl bg-accent-soft px-4 py-3 text-accent">
                <dt className="font-medium">You&apos;re owed</dt>
                <dd className="text-lg font-bold">£40.00</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-8 border-t border-line/10 bg-surface px-6 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">
            A little less admin
          </p>

          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Shared expenses in three steps.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-line bg-canvas p-7"
              >
                <span className="text-sm font-semibold text-accent">
                  {step.number}
                </span>

                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  {step.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-muted">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line/10 px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold tracking-tight">
            SPLIT<span className="text-accent">Mate</span>
          </p>

          <p className="text-muted">
            Less maths. More memories.
          </p>
        </div>
      </footer>
    </main>
  );
}