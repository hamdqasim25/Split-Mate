const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });

export default function ActivityList({ activity }: { activity: { id: number; description: string; createdAt: string }[] }) {
  return (
    <section aria-labelledby="activity-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="activity-heading" className="text-xl font-semibold">Recent activity</h2>
      <p className="mt-1 text-sm text-slate-500">The latest updates from your group.</p>
      {activity.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No activity yet. New expenses and group updates will appear here.</p> : (
        <ol className="mt-5 space-y-5">
          {activity.map(event => (
            <li key={event.id} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
              <div className="min-w-0">
                <p className="break-words text-sm leading-6 text-slate-800">{event.description}</p>
                <time dateTime={event.createdAt} className="mt-1 block text-xs text-slate-500">{dateFormat.format(new Date(event.createdAt))} (London)</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
