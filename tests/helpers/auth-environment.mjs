// Unit-test environment. Never import the production database or read .env.
export const state = {};

export function resetAuthEnvironment() {
  Object.assign(state, {
    users: [],
    sessions: [],
    cookieJar: new Map(),
    cookieWrites: [],
    events: [],
    reads: 0,
    failAt: null,
    failure: new Error("PRIVATE_DATABASE_ERROR_DETAIL"),
    insertConflict: false,
    transactions: 0,
  });
}

function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => row[key] === value);
}

function select(row, fields) {
  return row && (fields ? Object.fromEntries(fields.map((key) => [key, row[key]])) : { ...row });
}

function collection(model, getRows, fields, filter = {}) {
  return {
    select(...keys) {
      return collection(model, getRows, keys, filter);
    },
    where(predicate) {
      return collection(model, getRows, fields, predicate);
    },
    async first(predicate = filter) {
      state.reads += 1;
      if (state.failAt === `${model}.first`) throw state.failure;
      return select(getRows()[model].find((row) => matches(row, predicate)) ?? null, fields);
    },
    async create(data) {
      if (state.failAt === `${model}.create`) throw state.failure;
      const rows = getRows()[model];
      const row = { id: rows.length + 1, createdAt: new Date().toISOString(), ...data };
      if (model === "users" && state.insertConflict) {
        rows.push(row);
        throw Object.assign(new Error("PRIVATE_UNIQUE_ERROR"), { sqlState: "23505" });
      }
      if (model === "users" && rows.some((user) => user.email === data.email)) {
        throw Object.assign(new Error("PRIVATE_UNIQUE_ERROR"), { sqlState: "23505" });
      }
      if (model === "sessions" && !getRows().users.some((user) => user.id === data.userId)) {
        throw new Error("Session foreign key violation");
      }
      rows.push(row);
      state.events.push(`db:create:${model}`);
      return select(row, fields);
    },
    async delete() {
      state.events.push(`db:delete:${model}`);
      if (state.failAt === `${model}.delete`) throw state.failure;
      const rows = getRows()[model];
      const removed = rows.filter((row) => matches(row, filter));
      getRows()[model] = rows.filter((row) => !matches(row, filter));
      return removed;
    },
  };
}

function orm(getRows) {
  return {
    public: {
      User: collection("users", getRows),
      UserSession: collection("sessions", getRows),
      // Intentionally no GuestSession or GroupMember access.
    },
  };
}

export const db = {
  orm: orm(() => state),
  async transaction(callback) {
    state.transactions += 1;
    const staged = structuredClone({ users: state.users, sessions: state.sessions });
    try {
      const result = await callback({ orm: orm(() => staged) });
      state.users = staged.users;
      state.sessions = staged.sessions;
      state.events.push("db:commit");
      return result;
    } catch (error) {
      state.events.push("db:rollback");
      throw error;
    }
  },
};

export async function cookies() {
  return {
    get(name) {
      return state.cookieJar.has(name) ? { name, value: state.cookieJar.get(name) } : undefined;
    },
    set(name, value, options) {
      state.events.push("cookie:set");
      state.cookieWrites.push({ name, value, options });
      if (options.maxAge === 0) state.cookieJar.delete(name);
      else state.cookieJar.set(name, value);
    },
  };
}
