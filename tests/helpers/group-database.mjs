// Transaction double only: tests must never load the real client or cloud URL.
export const state = {};

export function resetDatabase({ owner = { id: 7, name: "Hamdi" }, failAt = null } = {}) {
  Object.assign(state, {
    owner,
    failAt,
    failure: new Error("Simulated database failure"),
    transactions: 0,
    commits: 0,
    rollbacks: 0,
    writes: 0,
    rows: { Group: [], GroupMember: [], ActivityEvent: [] },
  });
}

function project(row, fields) {
  return fields ? Object.fromEntries(fields.map((field) => [field, row[field]])) : row;
}

export const db = {
  async transaction(callback) {
    state.transactions += 1;
    const staged = structuredClone(state.rows);

    function collection(model, fields) {
      return {
        select(...selection) {
          return collection(model, selection);
        },
        async create(data) {
          state.writes += 1;
          if (state.writes === state.failAt) throw state.failure;
          const row = { ...data, id: staged[model].length + 1 };
          staged[model].push(row);
          return project(row, fields);
        },
      };
    }

    const tx = {
      orm: {
        public: {
          User: {
            select(...fields) {
              return {
                async first({ id }) {
                  return state.owner?.id === id ? project(state.owner, fields) : null;
                },
              };
            },
          },
          Group: collection("Group"),
          GroupMember: collection("GroupMember"),
          ActivityEvent: collection("ActivityEvent"),
        },
      },
    };

    try {
      const result = await callback(tx);
      state.rows = staged;
      state.commits += 1;
      return result;
    } catch (error) {
      state.rollbacks += 1;
      throw error;
    }
  },
};
