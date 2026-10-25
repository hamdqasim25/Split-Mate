"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteGroupForOwner, GroupDeletionError } from "@/data/group-deletion";

export async function deleteGroupAction(groupId: number, _previous: { error?: string }, form: FormData) {
  let group;
  try {
    if (form.get("confirmed") !== "yes") throw new GroupDeletionError("Confirm the group deletion first.");
    group = await deleteGroupForOwner(groupId);
  } catch (error) {
    if (!(error instanceof GroupDeletionError)) console.error("Group deletion failed unexpectedly.");
    return { error: error instanceof GroupDeletionError ? error.message : "Unable to delete this group. Return to the dashboard to check its current state before trying again." };
  }
  revalidatePath(`/groups/${group.id}`, "layout");
  revalidatePath(`/g/${group.shareToken}`, "layout");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
