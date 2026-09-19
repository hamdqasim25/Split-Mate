"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ApiError = {
  error?: {
    code?: string;
    message?: string;
    field?: string;
  };
};

export default function CreateGroupForm() {
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [memberNames, setMemberNames] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateMember(index: number, value: string) {
    setMemberNames((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index ? value : member,
      ),
    );
  }

  function addMember() {
    if (memberNames.length >= 50) return;

    setMemberNames((current) => [...current, ""]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const guests = memberNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName,
          currency: "GBP",
          memberNames: guests,
        }),
      });

      const body = (await response.json().catch(() => null)) as ApiError | null;

      if (response.status === 401) {
        router.push("/login?next=/groups/new");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(
          body?.error?.message ??
            "Unable to create the group. Please try again.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Unable to reach SPLITMate. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <label
          htmlFor="group-name"
          className="block text-sm font-semibold text-slate-900"
        >
          Group name
        </label>

        <input
          id="group-name"
          name="groupName"
          type="text"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="e.g. Weekend trip"
          maxLength={100}
          required
          disabled={isSubmitting}
          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Add members</h2>

        <p className="mt-2 text-sm text-slate-600">
          You are added automatically as the group owner.
        </p>

        <div className="mt-6 space-y-4">
          {memberNames.map((memberName, index) => (
            <div key={index}>
              <label
                htmlFor={`member-${index}`}
                className="sr-only"
              >
                Member {index + 1}
              </label>

              <input
                id={`member-${index}`}
                name={`member-${index}`}
                type="text"
                value={memberName}
                onChange={(event) =>
                  updateMember(index, event.target.value)
                }
                placeholder={
                  index === 0
                    ? "e.g. Yamin"
                    : index === 1
                      ? "e.g. Mohammed"
                      : `Member ${index + 1}`
                }
                maxLength={100}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addMember}
          disabled={isSubmitting || memberNames.length >= 50}
          className="mt-5 text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          + Add another member
        </button>
      </section>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/dashboard"
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating group..." : "Create group"}
        </button>
      </div>
    </form>
  );
}