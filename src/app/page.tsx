import Link from "next/link";

const steps = [
  { number: "01", title: "Create a group", description: "Bring your flatmates, travel buddies, or dinner crew together. Give every shared adventure a home." },
  { number: "02", title: "Add expenses", description: "Record what was paid, who paid it, and who is sharing the cost. Keep the little things accounted for." },
  { number: "03", title: "Track payments", description: "See who owes what at a glance, and keep track as everyone settles up. No awkward calculations." },
];

const expenses = [
  { initial: "S", title: "Somewhere to stay", detail: "You paid · Split equally", amount: "£120.00" },
  { initial: "D", title: "Dinner together", detail: "Alex paid · Split equally", amount: "£75.00" },
  { initial: "T", title: "Train tickets", detail: "Sam paid · Split equally", amount: "£45.00" },
];

const primaryLink = "inline-flex items-center justify-center gap-3 rounded-full bg-emerald-800 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8faf7] font-sans text-slate-900">
      <header className="border-b border-slate-900/10">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-emerald-800 text-2xl text-white">÷</span>
            <span>SPLIT<span className="text-emerald-800">Mate</span></span>
          </Link>
          <div className="flex items-center gap-8">
            <a href="#how-it-works" className="hidden text-sm font-medium text-slate-600 hover:text-emerald-800 sm:block">How it works</a>
            <Link href="/dashboard" className={primaryLink}>Get started <span aria-hidden="true">↗</span></Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-800/15 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-700" />Shared costs, made simple
          </p>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Split expenses.<span className="mt-2 block text-emerald-800">Keep friendships simple.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-600">Weekend trips. Shared bills. One more round. Keep group expenses organised and see who owes what with SPLITMate.</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href="/dashboard" className={primaryLink}>Get started <span aria-hidden="true">→</span></Link>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-emerald-800">See how it works</a>
          </div>
          <p className="mt-7 text-xs font-medium tracking-wide text-slate-500">Less chasing payments. More making plans.</p>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="absolute -inset-3 rounded-[2.5rem] bg-emerald-100/60 sm:-inset-5 sm:rotate-2" />
          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your group</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Weekend trip</h2>
                <p className="mt-1 text-sm text-slate-500">You, Alex, and Sam</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Example</span>
            </div>
            <div className="mt-6 rounded-2xl bg-emerald-900 p-5 text-white">
              <p className="text-sm text-emerald-100">Total group expenses</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">£240<span className="text-2xl text-emerald-200">.00</span></p>
              <p className="mt-3 text-xs text-emerald-100">3 expenses · 3 friends · All in one place</p>
            </div>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">Recent expenses</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {expenses.map((expense) => (
                <li key={expense.title} className="flex items-center gap-3 py-3.5">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">{expense.initial}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{expense.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{expense.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{expense.amount}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div><dt className="text-slate-500">Your share</dt><dd className="mt-1 font-semibold">£80.00</dd></div>
              <div className="text-right"><dt className="text-slate-500">You paid</dt><dd className="mt-1 font-semibold">£120.00</dd></div>
              <div className="col-span-2 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                <dt className="font-medium">You&apos;re owed</dt><dd className="text-lg font-bold">£40.00</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-8 border-t border-slate-900/10 bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-800">A little less admin</p>
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">Shared expenses in three steps.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-slate-200 bg-[#f8faf7] p-7">
                <span className="text-sm font-semibold text-emerald-700">{step.number}</span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900/10 px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold tracking-tight">SPLIT<span className="text-emerald-800">Mate</span></p>
          <p className="text-slate-500">Less maths. More memories.</p>
        </div>
      </footer>
    </main>
  );
}
