import {BehaviorSubject, Subject} from 'rxjs';
import sift from 'sift';

export interface QueryCacheInterface {
  count(query: any): Promise<{ count: number }>;

  read(query: any, order: { property: string, direction: 1 | -1, type: 'string' | 'number' }[], pageSize: number, skip: number): Promise<{ result: any[] }>;

  findOne(query: any): Promise<any>;

  deleteOne(query: any): Promise<any>;

  updateOne(query: any, item: any): Promise<void>;

  insertOne(newItem: any): Promise<void>;
}

export const createOrderFunction = (order: { property: string; direction: 1 | -1; type: 'string' | 'number' }[]) => {
  return (a, b) => {
    for (const o of order) {
      if (o.type === 'string' && a[o.property] !== b[o.property]) {
        return a[o.property].localeCompare(b[o.property]) * o.direction;
      }
      if (o.type === 'number' && a[o.property] !== b[o.property]) {
        return (a[o.property] - b[o.property]) * o.direction;
      }
    }
    return 0;
  };
};


export type DbQueryCacheWsData = { count: number } | { more: boolean } | { data: any[] } | { deleteItem: any };


export class DbQueryCacheReader<T> {

  public data = new BehaviorSubject<{ more: boolean, count: number, data: T[] }>({more: true, count: 0, data: []});

  constructor(
      private equals: (a: T, b: T) => boolean,
  ) {
  }


  public next(dataItem: DbQueryCacheWsData) {
    if ((dataItem as any).count) {
      this.data.value.count = (dataItem as any).count;
      this.data.next(this.data.value);
    }
    if ((dataItem as any).data) {
      this.data.value.data = [...this.data.value.data, ...((dataItem as any).data)];
      this.data.next(this.data.value);
    }
    if (typeof (dataItem as any).more === 'boolean') {
      this.data.value.more = (dataItem as any).more;
      this.data.next(this.data.value);
    }
    if ((dataItem as any).deleteItem) {
      this.data.value.data = this.data.value.data.filter(item => !this.equals(item, (dataItem as any).deleteItem));
      this.data.next(this.data.value);
    }
  }

}


export class DbQueryCacheClient {

  public task: 'start-count' | 'read-page' | 'pending' | 'dead';
  public hasTask: boolean;

  public count: number;

  public subject: Subject<DbQueryCacheWsData> = new Subject<DbQueryCacheWsData>();
  public onDestroy: () => void;

  private skip: number;
  private filterFunction: any;
  private sortFunction: (a, b) => (number | number);
  private lastSkippedItem: number;


  constructor(
      private queryCache: DbQueryCache,
      private query: any,
      private order: { property: string, direction: 1 | -1, type: 'string' | 'number' }[],
      private pageSize: number,
  ) {
    this.task = 'start-count';
    this.hasTask = true;
    this.skip = 0;
    this.filterFunction = sift(query);
    this.sortFunction = createOrderFunction(order);
  }

  public nextTask(): Promise<void> {
    if (!this.hasTask) {
      return;
    }
    if (this.task === 'start-count') {
      return this.queryCache.dbInterface.count(this.query).then((count) => {
        this.count = count.count;
        this.subject.next({count: count.count});
        if (count.count) {
          this.task = 'read-page';
        } else {
          this.subject.next({more: false});
          this.task = 'pending';
          this.hasTask = false;
        }
      });
    }
    if (this.task === 'read-page') {
      return this.queryCache.dbInterface.read(this.query, this.order, this.pageSize, this.skip).then((data) => {
        this.subject.next({data: data.result});
        this.skip += data.result.length;
        if (this.skip >= this.count) {
          this.subject.next({more: false});
          this.task = 'pending';
          this.hasTask = false;
          this.lastSkippedItem = null;
          this.skip = null;
        } else {
          this.lastSkippedItem = data.result[data.result.length - 1];
        }
      });
    }
    return Promise.reject('no task');
  }

  public insertItem(item: any) {
    if (!this.filterFunction(item)) {
      return;
    }
    if (this.task === 'pending') {
      this.count++;
      this.subject.next({more: true});
      this.subject.next({count: this.count});
      this.subject.next({data: [item]});
      this.subject.next({more: false});
      this.hasTask = false;
    }
    if (this.task === 'read-page') {
      this.count++;
      this.subject.next({count: this.count});
      if (this.lastSkippedItem && this.sortFunction(this.lastSkippedItem, item) > 0) {
        this.skip++;
        this.subject.next({data: [item]});
      }
    }
  }

  public deleteItem(item: any, moreOperations: boolean) {
    if (!this.filterFunction(item)) {
      return;
    }
    if (this.task === 'pending') {
      this.count--;
      this.subject.next({count: this.count});
      this.subject.next({deleteItem: item});
      if (!moreOperations) {
        this.subject.next({more: false});
      }
      this.hasTask = false;
    }
    if (this.task === 'read-page') {
      this.count--;
      this.subject.next({count: this.count});
      if (this.lastSkippedItem && this.sortFunction(this.lastSkippedItem, item) > 0) {
        this.skip--;
        this.subject.next({deleteItem: item});
      }
      if (this.skip >= this.count) {
        this.subject.next({more: false});
        this.hasTask = false;
      }
    }
  }

  public destroy() {
    this.task = 'dead';
    this.hasTask = false;
    this.queryCache.removeClient(this);
    this.onDestroy?.();
  }
}


export class DbQueryCache {

  private clients: DbQueryCacheClient[] = [];

  constructor(
      public dbInterface: QueryCacheInterface,
  ) {
  }

  public createClient(query: any, order: { property: string, direction: 1 | -1, type: 'string' | 'number' }[], pageSize: number): DbQueryCacheClient {
    const client = new DbQueryCacheClient(this, query, order, pageSize);
    this.clients.push(client);
    return client;
  }

  public removeClient(client: DbQueryCacheClient): void {
    const index = this.clients.indexOf(client);
    if (index >= 0) {
      this.clients.splice(index, 1);
    }
  }

  public insertItem(item: any): Promise<void> {
    this.clients.forEach(client => {
      client.insertItem(item);
    });
    return this.dbInterface.insertOne(item);
  }

  public update(query: any, newItem: any): Promise<void> {
    return this.dbInterface.findOne(query).then(oldItem => {
      this.clients.forEach(client => {
        client.deleteItem(oldItem, true);
      });
      this.clients.forEach(client => {
        client.insertItem(newItem);
      });
      return this.dbInterface.updateOne(query, newItem);
    })
    //return this.dbInterface.insertOne(item);
  }


  public deleteItem(query: any): Promise<void> {
    return this.dbInterface.deleteOne(query).then(item => {
      this.clients.forEach(client => {
        client.deleteItem(item, false);
      });
    });
  }


}
