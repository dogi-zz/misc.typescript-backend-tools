import * as _ from 'lodash';
import sift from 'sift';
import {
  createOrderFunction,
  DbQueryCache,
  DbQueryCacheReader,
  DbQueryCacheWsData,
  QueryCacheInterface
} from '../lib/db-query-cache';
import {TEST_DATA} from './test-data';

describe('DbQueryCache', () => {

  let data: { id: string, v_name: string, n_name: string, datum1: string, zahl1: number, email: string, datum2: string }[];
  let originalData: { id: string, v_name: string, n_name: string, datum1: string, zahl1: number, email: string, datum2: string }[];

  let dbInterface: QueryCacheInterface;
  let queryCache: DbQueryCache;

  const getOrigData = (ids: string[]) => ids.map(id => originalData.find(item => item.id === id));
  const getNewData = (ids: string[]) => ids.map(id => data.find(item => item.id === id));

  beforeEach(async () => {
    data = [...TEST_DATA];
    originalData = [...data];

    dbInterface = {
      count(query: any): Promise<{ count: number }> {
        const filter = sift(query);
        return Promise.resolve({
          count: data.filter(item => filter(item)).length,
        });
      },
      read(query: any, order: { property: string; direction: 1 | -1; type: 'string' | 'number' }[], pageSize: number, skip: number): Promise<{ result: any[] }> {
        const filter = sift(query);
        const result = data.filter(item => filter(item));
        result.sort(createOrderFunction(order));
        return Promise.resolve({
          result: result.slice(skip, skip + pageSize),
        });
      },
      findOne(query: any): Promise<any> {
        const filter = sift(query);
        const foundItem = data.find(filter);
        return Promise.resolve(_.cloneDeep(foundItem));
      },
      deleteOne(query: any): Promise<any> {
        const filter = sift(query);
        const itemToDelete = data.find(filter);
        if (itemToDelete) {
          data.splice(data.indexOf(itemToDelete), 1);
        }
        return Promise.resolve(_.cloneDeep(itemToDelete));
      },
      insertOne(newItem: any): Promise<void> {
        data = [...data, newItem];
        originalData = [...originalData, newItem];
        return Promise.resolve();
      },
      updateOne(query: any, item: any): Promise<void> {
        const filter = sift(query);
        const itemToUpdate = data.find(filter);
        if (itemToUpdate) {
          data[data.indexOf(itemToUpdate)] = item;
        }
        return Promise.resolve();
      },
    };

    queryCache = new DbQueryCache(dbInterface);

  });


  it('DbQueryCache  Leeres Array', async () => {
    data = [];

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(0);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    expect(readData).toEqual([
      {count: 0},
      {more: false},
    ]);

    // FERTIG


    // Einfügen eines Elements

    await queryCache.insertItem({
      id: 'abc050',
      v_name: 'Max',
      n_name: 'Mustermann',
      datum1: null,
      zahl1: 1764283985,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 0},
      {more: false},
      {more: true},
      {count: 1},
      {data: getOrigData(['abc050'])},
      {more: false},
    ]);

  });


  it('DbQueryCache Client', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(31);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 31},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 3
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
      {data: getOrigData(['abc021', 'abc022', 'abc023', 'abc024', 'abc025', 'abc026', 'abc027', 'abc028', 'abc029', 'abc030'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 4
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
      {data: getOrigData(['abc021', 'abc022', 'abc023', 'abc024', 'abc025', 'abc026', 'abc027', 'abc028', 'abc029', 'abc030'])},
      {data: getOrigData(['abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    // Einfügen eines Elements

    await queryCache.insertItem({
      id: 'abc050',
      v_name: 'Max',
      n_name: 'Mustermann',
      datum1: null,
      zahl1: 1764283985,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
      {data: getOrigData(['abc021', 'abc022', 'abc023', 'abc024', 'abc025', 'abc026', 'abc027', 'abc028', 'abc029', 'abc030'])},
      {data: getOrigData(['abc031'])},
      {more: false},
      {more: true},
      {count: 32},
      {data: getOrigData(['abc050'])},
      {more: false},
    ]);


  });


  it('DbQueryCache Client - Sortiert', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(31);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 31},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc026', 'abc025', 'abc024', 'abc021', 'abc007', 'abc008', 'abc016', 'abc001', 'abc020', 'abc022'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc026', 'abc025', 'abc024', 'abc021', 'abc007', 'abc008', 'abc016', 'abc001', 'abc020', 'abc022'])},
      {data: getOrigData(['abc023', 'abc014', 'abc013', 'abc027', 'abc012', 'abc028', 'abc011', 'abc010', 'abc030', 'abc003'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 3
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc026', 'abc025', 'abc024', 'abc021', 'abc007', 'abc008', 'abc016', 'abc001', 'abc020', 'abc022'])},
      {data: getOrigData(['abc023', 'abc014', 'abc013', 'abc027', 'abc012', 'abc028', 'abc011', 'abc010', 'abc030', 'abc003'])},
      {data: getOrigData(['abc006', 'abc005', 'abc017', 'abc029', 'abc009', 'abc004', 'abc002', 'abc015', 'abc031', 'abc018'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 4
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc026', 'abc025', 'abc024', 'abc021', 'abc007', 'abc008', 'abc016', 'abc001', 'abc020', 'abc022'])},
      {data: getOrigData(['abc023', 'abc014', 'abc013', 'abc027', 'abc012', 'abc028', 'abc011', 'abc010', 'abc030', 'abc003'])},
      {data: getOrigData(['abc006', 'abc005', 'abc017', 'abc029', 'abc009', 'abc004', 'abc002', 'abc015', 'abc031', 'abc018'])},
      {data: getOrigData(['abc019'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);


    // Einfügen eines Elements

    await queryCache.insertItem({
      id: 'abc050',
      v_name: 'Max',
      n_name: 'Mustermann',
      datum1: null,
      zahl1: 1764283985,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc026', 'abc025', 'abc024', 'abc021', 'abc007', 'abc008', 'abc016', 'abc001', 'abc020', 'abc022'])},
      {data: getOrigData(['abc023', 'abc014', 'abc013', 'abc027', 'abc012', 'abc028', 'abc011', 'abc010', 'abc030', 'abc003'])},
      {data: getOrigData(['abc006', 'abc005', 'abc017', 'abc029', 'abc009', 'abc004', 'abc002', 'abc015', 'abc031', 'abc018'])},
      {data: getOrigData(['abc019'])},
      {more: false},
      {more: true},
      {count: 32},
      {data: getOrigData(['abc050'])},
      {more: false},
    ]);

  });


  it('DbQueryCache Client - Sortiert Gefiltert', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    // Einfügen eines Elements

    await queryCache.insertItem({
      id: 'abc050',
      v_name: 'Max',
      n_name: 'Mustermann',
      datum1: '20.01.2000',
      zahl1: 1764283985,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
    ]);

    await queryCache.insertItem({
      id: 'abc051',
      v_name: 'Max2',
      n_name: 'Mustermann2',
      datum1: null,
      zahl1: 1764283986,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
      {more: true},
      {count: 16},
      {data: getOrigData(['abc051'])},
      {more: false},
    ]);

  });


  it('DbQueryCache Client - Einfügen während noch selektiert wird am Beispiel Sortiert Gefiltert', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Einfügen zu Beginn
    await queryCache.insertItem({
      id: 'abc051',
      v_name: 'Max51',
      n_name: 'Mustermann51',
      datum1: null,
      zahl1: 1764283986,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
    ]);

    // Das beeinflusst nix
    await queryCache.insertItem({
      id: 'abc052',
      v_name: 'Max52',
      n_name: 'Mustermann52',
      datum1: '20.01.2013',
      zahl1: 1764283986,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
    ]);


    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    // Einfügen hinter dem aktuellen Selektionsfenster
    await queryCache.insertItem({
      id: 'abc053',
      v_name: 'Max53',
      n_name: 'Mustermann53',
      datum1: null,
      zahl1: 1807306977,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 17},
    ]);

    // Einfügen vor dem aktuellen Selektionsfenster
    await queryCache.insertItem({
      id: 'abc054',
      v_name: 'Max54',
      n_name: 'Mustermann54',
      datum1: null,
      zahl1: 1706652165,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 17},
      {count: 18},
      {data: getOrigData(['abc054'])},
    ]);


    // Lesen Des Rests
    await client.nextTask();

    expect(client.count).toEqual(18);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    expect(readData).toEqual([
      {count: 15},
      {count: 16},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 17},
      {count: 18},
      {data: getOrigData(['abc054'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc051', 'abc031', 'abc053'])},
      {more: false},
    ]);

  });

  it('DbQueryCache Client - Einfügen während noch selektiert wird am einfacheren Beispiel', async () => {

    data = TEST_DATA.filter((item, idx) => idx % 2 === 0).map(item => ({...item, datum1: '01.01.1980'}));
    originalData = [...data];

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: {$ne: null}}, [{property: 'id', direction: 1, type: 'string'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(16);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 16},
    ]);

    // Einfügen zu Beginn
    await queryCache.insertItem({
      id: 'abc006',
      v_name: 'Max',
      n_name: 'Mustermann06',
      datum1: '20.01.2013',
      zahl1: 1764283986,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
    ]);

    // Das beeinflusst nix
    await queryCache.insertItem({
      id: 'abc008',
      v_name: 'Max',
      n_name: 'Mustermann08',
      datum1: null,
      zahl1: 1764283986,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
    ]);


    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc006', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017'])},
    ]);

    // Einfügen hinter dem aktuellen Selektionsfenster
    await queryCache.insertItem({
      id: 'abc018',
      v_name: 'Max',
      n_name: 'Mustermann18',
      datum1: '20.01.2013',
      zahl1: 1807306977,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc006', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017'])},
      {count: 18},
    ]);

    // Einfügen vor dem aktuellen Selektionsfenster
    await queryCache.insertItem({
      id: 'abc016',
      v_name: 'Max',
      n_name: 'Mustermann16',
      datum1: '20.01.2013',
      zahl1: 1706652165,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc006', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017'])},
      {count: 18},
      {count: 19},
      {data: getOrigData(['abc016'])},
    ]);


    // Lesen Des Rests
    await client.nextTask();

    expect(client.count).toEqual(19);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    expect(readData).toEqual([
      {count: 16},
      {count: 17},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc006', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017'])},
      {count: 18},
      {count: 19},
      {data: getOrigData(['abc016'])},
      {data: getOrigData(['abc018', 'abc019', 'abc021', 'abc023', 'abc025', 'abc027', 'abc029', 'abc031'])},
      {more: false},
    ]);

  });

  it('DbQueryCache Client - Löschen eines Eintrags', async () => {

    data = TEST_DATA.filter((item, idx) => idx % 2 === 0 || item.id === 'abc002').map(item => ({
      ...item,
      datum1: item.id === 'abc002' ? null : '01.01.1980',
    }));
    originalData = [...data];

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: {$ne: null}}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(16);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 16},
    ]);

    // Löschen vor Beginn
    await queryCache.deleteItem({id: 'abc003'});

    expect(readData).toEqual([
      {count: 16},
      {count: 15},
    ]);

    // Das beeinflusst nix
    await queryCache.deleteItem({id: 'abc002'});


    expect(readData).toEqual([
      {count: 16},
      {count: 15},
    ]);


    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 16},
      {count: 15},
      {data: getOrigData(['abc001', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019', 'abc021'])},
    ]);

    // Löschen hinter dem aktuellen Selektionsfenster
    await queryCache.deleteItem({id: 'abc025'});


    expect(readData).toEqual([
      {count: 16},
      {count: 15},
      {data: getOrigData(['abc001', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019', 'abc021'])},
      {count: 14},
    ]);

    // Löschen vor dem aktuellen Selektionsfenster
    await queryCache.deleteItem({id: 'abc011'});

    expect(readData).toEqual([
      {count: 16},
      {count: 15},
      {data: getOrigData(['abc001', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019', 'abc021'])},
      {count: 14},
      {count: 13},
      {deleteItem: getOrigData(['abc011'])[0]},
    ]);


    // Lesen Des Rests
    await client.nextTask();

    expect(client.count).toEqual(13);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

    expect(readData).toEqual([
      {count: 16},
      {count: 15},
      {data: getOrigData(['abc001', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019', 'abc021'])},
      {count: 14},
      {count: 13},
      {deleteItem: getOrigData(['abc011'])[0]},
      {data: getOrigData(['abc023', 'abc027', 'abc029', 'abc031'])},
      {more: false},
    ]);

  });

  it('DbQueryCache Client - Löschen des zufällig letzten Eintrags', async () => {

    data = TEST_DATA.filter((item, idx) => idx % 2 === 0 && idx < 21).map(item => ({
      ...item,
      datum1: '01.01.1980',
    }));
    originalData = [...data];

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: {$ne: null}}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(11);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 11},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 11},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019'])},
    ]);

    // Löschen des zufällig nächsten
    await queryCache.deleteItem({id: 'abc021'});


    expect(readData).toEqual([
      {count: 11},
      {data: getOrigData(['abc001', 'abc003', 'abc005', 'abc007', 'abc009', 'abc011', 'abc013', 'abc015', 'abc017', 'abc019'])},
      {count: 10},
      {more: false},
    ]);

  });


  it('DbQueryCache Client - Löschen des zufällig einzigen Eintrags', async () => {
    data = TEST_DATA.filter((item, idx) => idx === 1);
    originalData = [...data];

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(1);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 1},
    ]);

    await queryCache.deleteItem({id: 'abc002'});

    // Lese Page 1
    expect(client.hasTask).toEqual(false);

    expect(readData).toEqual([
      {count: 1},
      {count: 0},
      {more: false},
    ]);
  });


  it('Abbestellen der Daten', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({}, [{property: 'id', direction: 1, type: 'string'}], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(31);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 31},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
    ]);

    // Hier wird abbestellt

    client.destroy();

    expect(client.task).toEqual('dead');
    expect(client.hasTask).toEqual(false);

    // Lese Page 3
    await client.nextTask();

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
    ]);

    expect(client.task).toEqual('dead');
    expect(client.hasTask).toEqual(false);


    // Einfügen eines Elements

    await queryCache.insertItem({
      id: 'abc050',
      v_name: 'Max',
      n_name: 'Mustermann',
      datum1: null,
      zahl1: 1764283985,
      email: '',
      datum2: '20.01.2013',
    });

    expect(readData).toEqual([
      {count: 31},
      {data: getOrigData(['abc001', 'abc002', 'abc003', 'abc004', 'abc005', 'abc006', 'abc007', 'abc008', 'abc009', 'abc010'])},
      {data: getOrigData(['abc011', 'abc012', 'abc013', 'abc014', 'abc015', 'abc016', 'abc017', 'abc018', 'abc019', 'abc020'])},
    ]);


  });


  it('DbQueryCache Client - Update mit Verschiebung nach hinten', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    // Update

    await queryCache.update({id: 'abc007'}, {
      id: 'abc007',
      v_name: 'Meinard',
      n_name: 'Singer',
      datum1: null,
      zahl1: 1755337695, // nach der 2
      email: '',
      datum2: '25.02.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {deleteItem: getOrigData(['abc007'])[0]},
      {count: 15},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {deleteItem: getOrigData(['abc007'])[0]},
      {count: 15},
      {data: getNewData(['abc029', 'abc009', 'abc004', 'abc002', 'abc007', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);


  });


  it('DbQueryCache Client - Update mit Verschiebung nach vorne', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    // Update

    await queryCache.update({id: 'abc002'}, {
      id: 'abc002',
      v_name: 'Colin',
      n_name: 'Stobbe',
      datum1: null,
      zahl1: 1514908950, // vor der 7
      email: 'colin-stobbe@web.none',
      datum2: '07.03.1978',
    });


    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {count: 15},
      {data: getNewData(['abc002'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {count: 15},
      {data: getNewData(['abc002'])},
      {data: getNewData(['abc029', 'abc009', 'abc004', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

  });


  it('DbQueryCache Client - Update nur vorne', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    // Update

    await queryCache.update({id: 'abc007'}, {
      id: 'abc007',
      v_name: 'Meinard',
      n_name: 'Singer',
      datum1: null,
      zahl1: 1514908951 - 1,
      email: '',
      datum2: '25.02.2013',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {deleteItem: getOrigData(['abc007'])[0]},
      {count: 15},
      {data: getNewData(['abc007'])},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {deleteItem: getOrigData(['abc007'])[0]},
      {count: 15},
      {data: getNewData(['abc007'])},
      {data: getNewData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

  });

  it('DbQueryCache Client - Update nur hinten', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);

    // Update

    await queryCache.update({id: 'abc002'}, {
      id: 'abc002',
      v_name: 'Colin',
      n_name: 'Stobbe',
      datum1: null,
      zahl1: 1755337694 + 1,
      email: 'colin-stobbe@web.none',
      datum2: '07.03.1978',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {count: 15},
    ]);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {count: 14},
      {count: 15},
      {data: getNewData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);

  });


  it('DbQueryCache Client - Update nach allem', async () => {

    const readData: DbQueryCacheWsData[] = [];
    const client = queryCache.createClient({datum1: null}, [{property: 'zahl1', direction: 1, type: 'number'}, {
      property: 'id',
      direction: -1,
      type: 'string',
    }], 10);
    client.subject.subscribe(item => readData.push(item));

    expect(client.task).toEqual('start-count');
    expect(client.hasTask).toEqual(true);

    // Lese Count
    await client.nextTask();

    expect(client.count).toEqual(15);

    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    expect(readData).toEqual([
      {count: 15},
    ]);

    // Lese Page 1
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    ]);


    expect(client.task).toEqual('read-page');
    expect(client.hasTask).toEqual(true);

    // Lese Page 2
    await client.nextTask();

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
    ]);

    expect(client.task).toEqual('pending');
    expect(client.hasTask).toEqual(false);


    // Update

    await queryCache.update({id: 'abc002'}, {
      id: 'abc002',
      v_name: 'Colin',
      n_name: 'Stobbe',
      datum1: null,
      zahl1: 1755337694 + 1,
      email: 'colin-stobbe@web.none',
      datum2: '07.03.1978',
    });

    expect(readData).toEqual([
      {count: 15},
      {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
      {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
      {more: false},
      {count: 14},
      {deleteItem: getOrigData(['abc002'])[0]},
      {more: true},
      {count: 15},
      {data: getNewData(['abc002'])},
      {more: false},
    ]);


  });

  it('DbQueryCacheReader - read data', async () => {

    const reader = new DbQueryCacheReader<any>((a, b) => a.id === b.id);

    let readResult: { more: boolean, count: number, data: any[] } = null;
    const subscription = reader.data.subscribe(data => readResult = data);

    expect(readResult).toEqual({more: true, count: 0, data: []});

    reader.next({count: 15});
    expect(readResult).toEqual({more: true, count: 15, data: []});

    reader.next({data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])});
    expect(readResult).toEqual({
      more: true,
      count: 15,
      data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])
    });

    reader.next({data: getOrigData(['abc003'])});
    expect(readResult).toEqual({
      more: true,
      count: 15,
      data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031', 'abc003'])
    });

    reader.next({more: false});
    expect(readResult).toEqual({
      more: false,
      count: 15,
      data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031', 'abc003'])
    });

    reader.next({deleteItem: getOrigData(['abc002'])[0]});
    expect(readResult).toEqual({
      more: false,
      count: 15,
      data: getOrigData(['abc029', 'abc009', 'abc004', 'abc031', 'abc003'])
    });


    subscription.unsubscribe();
    //
    //
    // expect(readData).toEqual([
    //   {count: 15},
    //   {data: getOrigData(['abc026', 'abc025', 'abc007', 'abc001', 'abc027', 'abc012', 'abc028', 'abc030', 'abc003', 'abc005'])},
    //   {data: getOrigData(['abc029', 'abc009', 'abc004', 'abc002', 'abc031'])},
    //   {more: false},
    //   {count: 14},
    //   {deleteItem: getOrigData(['abc002'])[0]},
    //   {more: true},
    //   {count: 15},
    //   {data: getNewData(['abc002'])},
    //   {more: false},
    // ]);


  });

  afterEach(async () => {
  });

});
