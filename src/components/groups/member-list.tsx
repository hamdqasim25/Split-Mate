type Member = { id: number; name: string; joined: boolean; role?: string };

export default function MemberList({ members, currentMemberId }: { members: Member[]; currentMemberId?: number }) {
  return (
    <section aria-labelledby="members-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h2 id="members-heading" className="text-xl font-semibold">Group members</h2>
        <span className="rounded-full bg-subtle px-3 py-1 text-sm text-muted">{members.length}</span>
      </header>
      {members.length === 0 ? <p className="mt-4 text-sm text-muted">No active members to show.</p> : (
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map(member => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{member.name.trim().slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{member.name}{member.id === currentMemberId && <span className="ml-2 text-xs font-semibold text-accent">(You)</span>}</p>
                {member.role === "OWNER" && <p className="text-xs text-muted">Group owner</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${member.joined ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"}`}>{member.joined ? "Joined" : "Waiting"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-muted">Waiting members can join using the shared group link.</p>
    </section>
  );
}
