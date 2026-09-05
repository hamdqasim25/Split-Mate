import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard | SPLITMate",
  description: "Your shared expenses and groups, all in one place.",
};

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
        >
          <span aria-hidden="true">←</span> Back to home
        </Link>

        <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          Your dashboard
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
          Welcome to SPLITMate. This is where your groups, shared expenses,
          and balances will come together.
        </p>

        <section
          aria-labelledby="coming-soon"
          className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <h2 id="coming-soon" className="text-xl font-semibold">
            Your overview is coming soon
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Group management and expense tracking will appear here as we build
            your dashboard.
          </p>
        </section>
      </div>
    </main>
  );
}
