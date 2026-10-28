import { randomBytes, randomUUID, createHash } from "node:crypto";
import { connection, stopWorkers } from "./harness.mjs";
import { assertTestDatabase } from "./config.mjs";

const token = () => randomBytes(32).toString("base64url");
const hash = value => createHash("sha256").update(value).digest("hex");

export async function installControls(client) {
  await assertTestDatabase(client);
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS splitmate_test_control;
    CREATE TABLE IF NOT EXISTS splitmate_test_control.runs (id uuid PRIMARY KEY, "ownerId" int NOT NULL, created_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS splitmate_test_control.gates (worker text PRIMARY KEY, "groupId" int NOT NULL, gate int NOT NULL);
    CREATE TABLE IF NOT EXISTS splitmate_test_control.faults (worker text PRIMARY KEY, "groupId" int NOT NULL, stage text NOT NULL, event text);
    CREATE OR REPLACE FUNCTION splitmate_test_control.group_gate() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE gate_id int;
    BEGIN
      SELECT gate INTO gate_id FROM splitmate_test_control.gates WHERE worker=current_setting('application_name') AND "groupId"=NEW.id;
      IF gate_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(718204, gate_id); END IF;
      RETURN NEW;
    END $$;
    CREATE OR REPLACE FUNCTION splitmate_test_control.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE group_id int; fault record; event_type text; share_count int;
    BEGIN
      IF TG_TABLE_NAME='expenseParticipant' THEN
        SELECT "groupId" INTO group_id FROM public.expense WHERE id=NEW."expenseId";
        SELECT count(*) INTO share_count FROM public."expenseParticipant" WHERE "expenseId"=NEW."expenseId";
      ELSIF TG_TABLE_NAME='paymentAllocation' THEN
        SELECT "groupId" INTO group_id FROM public.payment WHERE id=NEW."paymentId";
      ELSIF TG_TABLE_NAME='groupMember' THEN group_id=OLD."groupId";
      ELSE group_id=NEW."groupId"; event_type=NEW."eventType";
      END IF;
      SELECT * INTO fault FROM splitmate_test_control.faults WHERE worker=current_setting('application_name') AND "groupId"=group_id;
      IF FOUND AND ((fault.stage='share_second' AND TG_TABLE_NAME='expenseParticipant' AND share_count=2)
        OR (fault.stage='allocation' AND TG_TABLE_NAME='paymentAllocation')
        OR (fault.stage='member_delete' AND TG_TABLE_NAME='groupMember')
        OR (fault.stage='activity' AND TG_TABLE_NAME='activityEvent' AND fault.event=event_type)) THEN
        RAISE EXCEPTION 'splitmate integration injected failure' USING ERRCODE='P0001';
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $$;
    DROP TRIGGER IF EXISTS splitmate_test_gate ON public."group";
    CREATE TRIGGER splitmate_test_gate AFTER UPDATE ON public."group" FOR EACH ROW EXECUTE FUNCTION splitmate_test_control.group_gate();
  `);
  for (const [table, event] of [["expenseParticipant", "INSERT"], ["paymentAllocation", "INSERT"], ["activityEvent", "INSERT"], ["groupMember", "DELETE"]]) {
    await client.query(`DROP TRIGGER IF EXISTS splitmate_test_failure ON public."${table}";
      CREATE TRIGGER splitmate_test_failure AFTER ${event} ON public."${table}" FOR EACH ROW EXECUTE FUNCTION splitmate_test_control.inject_failure();`);
  }
}

export async function cleanupRun(client, runId) {
  await assertTestDatabase(client);
  await client.query("BEGIN");
  try {
    const { rows: [run] } = await client.query('SELECT r."ownerId" FROM splitmate_test_control.runs r JOIN public."user" u ON u.id=r."ownerId" WHERE r.id=$1 AND u.email=$2', [runId, `splitmate-it-${runId}@example.invalid`]);
    if (!run) throw new Error("Test fixture ownership could not be verified; cleanup refused.");
    const id = run.ownerId;
    const groupIDs = '(SELECT id FROM public."group" WHERE "createdBy"=$1)';
    await client.query(`DELETE FROM public."guestSession" WHERE "groupMemberId" IN (SELECT id FROM public."groupMember" WHERE "groupId" IN ${groupIDs})`, [id]);
    await client.query(`DELETE FROM public."paymentAllocation" WHERE "paymentId" IN (SELECT id FROM public.payment WHERE "groupId" IN ${groupIDs})`, [id]);
    await client.query(`DELETE FROM public."expenseParticipant" WHERE "expenseId" IN (SELECT id FROM public.expense WHERE "groupId" IN ${groupIDs})`, [id]);
    for (const table of ["payment", "expense", "activityEvent", "groupMember"]) await client.query(`DELETE FROM public."${table}" WHERE "groupId" IN ${groupIDs}`, [id]);
    await client.query(`DELETE FROM splitmate_test_control.gates WHERE "groupId" IN ${groupIDs}`, [id]);
    await client.query(`DELETE FROM splitmate_test_control.faults WHERE "groupId" IN ${groupIDs}`, [id]);
    await client.query('DELETE FROM public."group" WHERE "createdBy"=$1', [id]);
    await client.query('DELETE FROM public."userSession" WHERE "userId"=$1', [id]);
    await client.query('DELETE FROM public."user" WHERE id=$1', [id]);
    await client.query("DELETE FROM splitmate_test_control.runs WHERE id=$1", [runId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

export async function fixture(t) {
  const observer = await connection();
  // Serialize fixture infrastructure across test files and simultaneous suite invocations.
  let runId;
  t.after(async () => {
    try { await stopWorkers(t); if (runId) await cleanupRun(observer, runId); }
    finally { try { await observer.query("SELECT pg_advisory_unlock_all()"); } finally { await observer.end(); } }
  });
  await observer.query("SELECT pg_advisory_lock(718203, 1)");
  await installControls(observer);
  const id = randomUUID();
  const ownerToken = token(); const guestToken = token(); const shareToken = token();
  await observer.query("BEGIN");
  let userId, groupId, ownerId, guestId, unclaimedId;
  try {
    const user = await observer.query('INSERT INTO public."user" (name,email,"passwordHash") VALUES ($1,$2,$3) RETURNING id', ["Integration owner", `splitmate-it-${id}@example.invalid`, "not-a-login-hash"]);
    userId = user.rows[0].id;
    await observer.query('INSERT INTO splitmate_test_control.runs (id,"ownerId") VALUES ($1,$2)', [id, userId]);
    const group = await observer.query('INSERT INTO public."group" (name,currency,"createdBy","shareToken") VALUES ($1,$2,$3,$4) RETURNING id', [`Integration ${id}`, "GBP", userId, shareToken]);
    groupId = group.rows[0].id;
    const member = async (name, user, role, claimed) => (await observer.query('INSERT INTO public."groupMember" ("groupId","userId",name,role,"claimedAt") VALUES ($1,$2,$3,$4,$5) RETURNING id', [groupId, user, name, role, claimed ? new Date() : null])).rows[0].id;
    ownerId = await member("Owner", userId, "OWNER", true);
    guestId = await member("Guest", null, "MEMBER", true);
    unclaimedId = await member("Unclaimed", null, "MEMBER", false);
    await observer.query('INSERT INTO public."userSession" ("userId","tokenHash","expiresAt") VALUES ($1,$2,now()+interval \'1 hour\')', [userId, hash(ownerToken)]);
    await observer.query('INSERT INTO public."guestSession" ("groupMemberId","tokenHash","expiresAt") VALUES ($1,$2,now()+interval \'1 hour\')', [guestId, hash(guestToken)]);
    await observer.query("COMMIT"); runId = id;
  } catch (error) { await observer.query("ROLLBACK"); throw error; }
  return { observer, groupId, ownerId, guestId, unclaimedId, shareToken, userId,
    owner: { kind: "owner", groupId }, guest: { kind: "guest", shareToken },
    ownerCookies: { splitmate_owner_session: ownerToken, "__Host-splitmate_owner_session": ownerToken },
    guestCookies: { splitmate_guest_session: guestToken, "__Host-splitmate_guest_session": guestToken },
    expense: () => ({ description: "Court", amount: "10.00", paidByMemberId: String(ownerId), participantIds: [String(guestId)], shares: [{ memberId: String(guestId), amount: "10.00" }] }),
  };
}

export async function snapshot(client, groupId) {
  const tables = {};
  for (const table of ["groupMember", "expense", "payment", "activityEvent"]) {
    tables[table] = (await client.query(`SELECT * FROM public."${table}" WHERE "groupId"=$1 ORDER BY id`, [groupId])).rows;
  }
  tables.group = (await client.query('SELECT * FROM public."group" WHERE id=$1', [groupId])).rows;
  tables.shares = (await client.query('SELECT s.* FROM public."expenseParticipant" s JOIN public.expense e ON e.id=s."expenseId" WHERE e."groupId"=$1 ORDER BY s.id', [groupId])).rows;
  tables.allocations = (await client.query('SELECT a.* FROM public."paymentAllocation" a JOIN public.payment p ON p.id=a."paymentId" WHERE p."groupId"=$1 ORDER BY a.id', [groupId])).rows;
  tables.sessions = (await client.query('SELECT s.* FROM public."guestSession" s JOIN public."groupMember" m ON m.id=s."groupMemberId" WHERE m."groupId"=$1 ORDER BY s.id', [groupId])).rows;
  // Assertion diffs must not print even disposable session hashes/share tokens.
  for (const row of tables.group) row.shareToken = "[redacted]";
  for (const row of tables.sessions) row.tokenHash = "[redacted]";
  return tables;
}
