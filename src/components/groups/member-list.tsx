type Member = { id: number; name: string; joined: boolean; role?: string };

export default function MemberList({ members, currentMemberId }: { members: Member[]; currentMemberId?: number }) {
  return (
    <section aria-labelledby="members-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h2 id="members-heading" className="text-xl font-semibold">Group members</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{members.length}</span>
      </header>
      {members.length === 0 ? <p className="mt-4 text-sm text-slate-600">No active members to show.</p> : (
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map(member => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-semibold text-emerald-800">{member.name.trim().slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{member.name}{member.id === currentMemberId && <span className="ml-2 text-xs font-semibold text-emerald-800">(You)</span>}</p>
                {member.role === "OWNER" && <p className="text-xs text-slate-500">Group owner</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${member.joined ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{member.joined ? "Joined" : "Waiting"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">Waiting members can join using the shared group link.</p>
    </section>
  );
}
