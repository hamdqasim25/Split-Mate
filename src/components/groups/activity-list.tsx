import { formatHistoryTime } from "@/lib/date-time";
import { activitySummary } from "@/lib/activity-summary";

export default function ActivityList({ activity }: { activity: { id: number; description: string; createdAt: string }[] }) {
  return (
    <section aria-labelledby="activity-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 id="activity-heading" className="text-xl font-semibold">Recent activity</h2>
      <p className="mt-1 text-sm text-muted">The latest updates from your group.</p>
      {activity.length === 0 ? <p className="mt-5 rounded-xl bg-subtle p-4 text-sm text-muted">No activity yet. New expenses and group updates will appear here.</p> : (
        <ol className="mt-3 divide-y divide-line">
          {activity.map(event => (
            <li key={event.id}>
              <details className="history-disclosure">
                <summary className="history-summary">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">{activitySummary(event.description)}</span>
                    <time dateTime={event.createdAt} className="mt-1 block text-xs text-muted">{formatHistoryTime(event.createdAt)}</time>
                  </span>
                  <span aria-hidden="true" className="history-chevron">⌄</span>
                  <span className="sr-only">Activity details</span>
                </summary>
                <div className="history-details space-y-2 text-sm">
                  <p className="whitespace-pre-wrap break-words">{event.description}</p>
                  <p className="text-xs text-muted"><time dateTime={event.createdAt}>{formatHistoryTime(event.createdAt, true)}</time> (London)</p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
