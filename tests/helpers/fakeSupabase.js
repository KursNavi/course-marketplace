/**
 * Minimaler Supabase-Client-Fake fuer Unit-Tests der aiSearch-Worker-Logik.
 *
 * Jeder Aufruf (from(...).select()... bzw. rpc) wird als ein "call"-Objekt
 * protokolliert und ueber die injizierte respond(call)-Funktion beantwortet
 * ({ data, error, count }). So bleiben die Tests ohne Netz und pruefen
 * gleichzeitig, WELCHE Abfragen mit welchen Filtern gestellt wurden.
 */

export function createFakeSupabase(respond) {
  const calls = [];

  function makeBuilder(table) {
    const call = {
      table,
      op: 'select',
      columns: undefined,
      payload: undefined,
      options: undefined,
      filters: [],
      order: [],
      limit: undefined,
      range: undefined,
      single: false,
      head: false,
      countMode: undefined,
    };
    const builder = {};
    const addFilter = (name) => (...args) => {
      call.filters.push([name, ...args]);
      return builder;
    };

    builder.select = (columns, options) => {
      if (call.op === 'select') {
        call.columns = columns;
        if (options?.head) call.head = true;
        if (options?.count) call.countMode = options.count;
      }
      return builder;
    };
    builder.update = (payload) => { call.op = 'update'; call.payload = payload; return builder; };
    builder.upsert = (payload, options) => { call.op = 'upsert'; call.payload = payload; call.options = options; return builder; };
    builder.insert = (payload) => { call.op = 'insert'; call.payload = payload; return builder; };
    builder.delete = () => { call.op = 'delete'; return builder; };
    for (const name of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'textSearch', 'or']) {
      builder[name] = addFilter(name);
    }
    builder.order = (column, options) => { call.order.push([column, options]); return builder; };
    builder.limit = (value) => { call.limit = value; return builder; };
    builder.range = (from, to) => { call.range = [from, to]; return builder; };

    const finish = () => {
      calls.push(call);
      return Promise.resolve(respond(call) ?? { data: null, error: null, count: null });
    };
    builder.maybeSingle = () => { call.single = true; return finish(); };
    builder.then = (onFulfilled, onRejected) => finish().then(onFulfilled, onRejected);
    return builder;
  }

  const client = {
    from: makeBuilder,
    rpc: (name, params) => {
      const call = { op: 'rpc', table: name, payload: params, filters: [] };
      calls.push(call);
      return Promise.resolve(respond(call) ?? { data: null, error: null });
    },
    auth: {
      getUser: (token) => {
        const call = { op: 'auth.getUser', table: 'auth', payload: token, filters: [] };
        calls.push(call);
        return Promise.resolve(respond(call) ?? { data: { user: null }, error: { message: 'no user' } });
      },
    },
  };

  return { client, calls };
}

/** Liefert den Wert eines Filters, z. B. filterValue(call, 'eq', 'status'). */
export function filterValue(call, name, column) {
  const hit = (call.filters ?? []).find(([n, c]) => n === name && c === column);
  return hit ? hit[2] : undefined;
}

/** Findet den ersten protokollierten Aufruf, der dem Muster entspricht. */
export function findCall(calls, matcher) {
  return calls.find(matcher);
}
