import {MutexChain, MutexChainSingleTask} from '../lib/mutex-chain';

const wait = ms => new Promise(res => setTimeout(res, ms));

describe('mutexChain', () => {


  beforeEach(async () => {

  });


  it('MutexChainSingleTask', async () => {

    let result: any[] = [];
    let p: Promise<any>;
    let manualAbort = false;

    // Einfachster Fall ohne Timeout

    result = [];
    p = MutexChainSingleTask.perform(Promise.resolve(123), res => {
      result.push(res);
      return 'done';
    }, 100).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error');
    });
    expect(result).toEqual([]);
    await p;
    expect(result).toEqual([123, 'done']);

    // Einfachster Fall mit Timeout

    result = [];
    p = MutexChainSingleTask.perform(wait(200).then(() => 123), res => {
      result.push(res);
      return 'done';
    }, 100).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error', e.message);
    });
    expect(result).toEqual([]);
    await p;
    expect(result).toEqual(['error', 'timeout']);

    // Die Callback kommt auch nimmer dran
    await wait(300);
    expect(result).toEqual(['error', 'timeout']);


    // Einfachster Fall mit einem Fehler in der Callback

    result = [];
    p = MutexChainSingleTask.perform(wait(50).then(() => 123), res => {
      throw new Error('custom Error');
    }, 100).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error', e.message);
    });
    expect(result).toEqual([]);
    await p;
    expect(result).toEqual(['error', 'custom Error']);

    // das Timeout kommt auch nicht mehr
    await wait(300);
    expect(result).toEqual(['error', 'custom Error']);


    // Einfachster Fall mit einem Reject im Promise

    result = [];
    p = MutexChainSingleTask.perform(wait(50).then(() => Promise.reject(new Error('this is wrong'))), res => {
      result.push(res);
      return 'done';
    }, 100).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error', e.message);
    });
    expect(result).toEqual([]);
    await p;
    expect(result).toEqual(['error', 'this is wrong']);

    // das Timeout kommt auch nicht mehr
    await wait(300);
    expect(result).toEqual(['error', 'this is wrong']);


    // Jetzt ein Task, der etwas dauert, aber kein Timeout hat

    result = [];
    p = MutexChainSingleTask.perform(wait(200).then(() => 123), res => {
      result.push(res);
      return 'done';
    }, 300, () => !manualAbort).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error');
    });
    expect(result).toEqual([]);
    await p;
    expect(result).toEqual([123, 'done']);


    // Jetzt ein Task, der sein Timeout nicht erreicht, aber abgebrochen wird

    result = [];
    p = MutexChainSingleTask.perform(wait(200).then(() => 123), res => {
      result.push(res);
      return 'done';
    }, 300, () => !manualAbort).then(res => {
      result.push(res);
    }).catch(e => {
      result.push('error');
    });
    expect(result).toEqual([]);
    // Wir haben 200ms zeit zum Abbrechen
    await wait(100);
    // hier brechen wir ab
    manualAbort = true;
    // hier brechen wir ab
    // Der Task kam nicht dran
    expect(result).toEqual([]);
    // Und wird auch nimmer drankommen
    await wait(150);
    expect(result).toEqual([]);

  });


  it('mutexChain - Ein Task mit drei Schritten, alle gut', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      return wait(100).then(() => 'done2');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1']);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3'], 'done3']);

  });

  it('mutexChain - Ein Task mit drei Schritten, der mittlere liefert ein Reject-Promise', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      return wait(100).then(() => Promise.reject('this is my error'));
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e);
    });

    expect(result).toEqual([]);

    await wait(10);

    // Die erste Funktion kam dran
    expect(result).toEqual(['run1']);

    // Das Promise der ersten Funktion kam dran, und die zweite Funktion
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    // Das Promise der zweiten funktion hatte den Fehler
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], 'this is my error']);

    // Die dritte Funcktion kam auch nimmer dran
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], 'this is my error']);

  });


  it('mutexChain - Ein Task mit drei Schritten, der Mittlere wirft einen Fehler', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      throw new Error('this was bad');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    // Die erste Funktion kam dran
    expect(result).toEqual(['run1']);

    // Das Promise der ersten Funktion kam dran, und die zweite Funktion
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], 'this was bad']);

    // Jetzt wäre die zweite Funktion fertig
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], 'this was bad']);

    // Die dritte Funktion kam auch nimmer dran
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], 'this was bad']);

  });

  it('mutexChain - Ein Task mit drei Schritten, der mittlere rennt in ein Timeout', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      return wait(100).then(() => 'done2');
    }, 90);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    }).catch(e => {
      // Der Fehler sollte schon aussagen, wo er herkommt
      result.push(e.stack.includes('MutexChain.spec.ts'));
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    // Die erste Funktion kam dran
    expect(result).toEqual(['run1']);

    // Das Promise der ersten Funktion kam dran, und die zweite Funktion
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    // Jetzt wäre die zweite Funktion fertig
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], true, 'timeout']);

    // Die dritte Funktion kam auch nimmer dran
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], true, 'timeout']);

  });


  it('mutexChain - Ein Task mit drei Schritten, nach dem zweiten wird abgebrochen', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      return wait(100).then(() => 'done2');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    }).catch(e => {
      // Der Fehler sollte schon aussagen, wo er herkommt
      result.push(e.stack.includes('MutexChain.spec.ts'));
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    // Die erste Funktion kam dran
    expect(result).toEqual(['run1']);

    // Das Promise der ersten Funktion kam dran, und die zweite Funktion
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    // Jetzt wäre die zweite Funktion fertig
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3']]);

    mutexChain.stop();

    // Die dritte Funktion kommt nimmer dran
    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3']]);

  });


  it('mutexChain - Ein Task mit drei Schritten, erstellt über den Chainer', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150)
        .addStep((last) => {
          result.push([last, 'run2']);
          return wait(100).then(() => 123);
        }, 150)
        .addStep((last) => {
          result.push([last, 'run3']);
          return wait(100).then(() => 'done3');
        }, 150);

    task.then((last) => {
      result.push(last);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1']);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], [123, 'run3']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], [123, 'run3'], 'done3']);

  });


  it('mutexChain - Ein Task mit drei Schritten, der zweite liefert einen Zwischenschritt der erst noch drankommt', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2']);
      return wait(100).then(() => 'done2');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1']);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2'], ['done2', 'run3'], 'done3']);

  });

  it('mutexChain - Ein Task mit drei Schritten, der zweite Task erstellt einen Schritt (Zwischenschritt)', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task = mutexChain.addTask();

    task.addStep(() => {
      result.push('run1');
      return wait(100).then(() => 'done1');
    }, 150);

    task.addStep((last) => {
      result.push([last, 'run2.1']);
      //return wait(100).then(() => 'done2.1');
      return task.addStep((innerLast) => {
        result.push([innerLast, 'run2.2']);
        return wait(100).then(() => 'done2.2');
      }, 150);
    }, 150);


    task.addStep((last) => {
      result.push([last, 'run3']);
      return wait(100).then(() => 'done3');
    }, 150);

    task.then((last) => {
      result.push(last);
    }).catch(e => {
      // Der Fehler sollte schon aussagen, wo er herkommt
      result.push(e.stack.includes('MutexChain.spec.ts'));
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1']);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2.1'], [undefined, 'run2.2']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2.1'], [undefined, 'run2.2'], ['done2.2', 'run3']]);

    await wait(100);
    expect(result).toEqual(['run1', ['done1', 'run2.1'], [undefined, 'run2.2'], ['done2.2', 'run3'], 'done3']);

  });

  it('mutexChain - Zwei Tasks in Konkurrenz', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task1 = mutexChain.addTask();
    const task2 = mutexChain.addTask();

    task1.addStep(() => {
      result.push('run1.1');
      return wait(100).then(() => 'done1.1');
    }, 150);

    task2.addStep(() => {
      result.push('run2.1');
      return wait(100).then(() => 'done2.1');
    }, 150);

    task1.addStep((last) => {
      result.push([last, 'run1.2']);
      return wait(100).then(() => 'done1.2');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.2']);
      return wait(100).then(() => 'done2.2');
    }, 150);


    task1.addStep((last) => {
      result.push([last, 'run1.3']);
      return wait(100).then(() => 'done1.3');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.3']);
      return wait(100).then(() => 'done2.3');
    }, 150);

    task1.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    task2.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3'], 'done1.3', 'run2.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3'], 'done1.3', 'run2.1', ['done2.1', 'run2.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3'], 'done1.3', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3'], 'done1.3', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3'], 'done2.3']);

  });


  it('mutexChain - Zwei Tasks in Konkurrenz, Abbruch während dem ersten', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task1 = mutexChain.addTask();
    const task2 = mutexChain.addTask();

    task1.addStep(() => {
      result.push('run1.1');
      return wait(100).then(() => 'done1.1');
    }, 150);

    task2.addStep(() => {
      result.push('run2.1');
      return wait(100).then(() => 'done2.1');
    }, 150);

    task1.addStep((last) => {
      result.push([last, 'run1.2']);
      return wait(100).then(() => 'done1.2');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.2']);
      return wait(100).then(() => 'done2.2');
    }, 150);


    task1.addStep((last) => {
      result.push([last, 'run1.3']);
      return wait(100).then(() => 'done1.3');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.3']);
      return wait(100).then(() => 'done2.3');
    }, 150);

    task1.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    task2.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

    mutexChain.stop();

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], ['done1.2', 'run1.3']]);

  });


  it('mutexChain - Zwei Tasks in Konkurrenz der erste schmiert in der Mitte ab', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task1 = mutexChain.addTask();
    const task2 = mutexChain.addTask();

    task1.addStep(() => {
      result.push('run1.1');
      return wait(100).then(() => 'done1.1');
    }, 150);

    task2.addStep(() => {
      result.push('run2.1');
      return wait(100).then(() => 'done2.1');
    }, 150);

    task1.addStep((last) => {
      result.push([last, 'run1.2']);
      return wait(100).then(() => Promise.reject(new Error('reject 1.2')));
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.2']);
      return wait(100).then(() => 'done2.2');
    }, 150);


    task1.addStep((last) => {
      result.push([last, 'run1.3']);
      return wait(100).then(() => 'done1.3');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.3']);
      return wait(100).then(() => 'done2.3');
    }, 150);

    task1.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    task2.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'reject 1.2', 'run2.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'reject 1.2', 'run2.1', ['done2.1', 'run2.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'reject 1.2', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'reject 1.2', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3'], 'done2.3']);

  });

  it('mutexChain - Zwei Tasks in Konkurrenz der erste wird in der Mitte nie fertig', async () => {

    const result: any[] = [];

    const mutexChain = new MutexChain();
    const task1 = mutexChain.addTask();
    const task2 = mutexChain.addTask();

    task1.addStep(() => {
      result.push('run1.1');
      return wait(100).then(() => 'done1.1');
    }, 150);

    task2.addStep(() => {
      result.push('run2.1');
      return wait(100).then(() => 'done2.1');
    }, 150);

    task1.addStep((last) => {
      result.push([last, 'run1.2']);
      return new Promise(() => {
      });
    }, 100);

    task2.addStep((last) => {
      result.push([last, 'run2.2']);
      return wait(100).then(() => 'done2.2');
    }, 150);


    task1.addStep((last) => {
      result.push([last, 'run1.3']);
      return wait(100).then(() => 'done1.3');
    }, 150);

    task2.addStep((last) => {
      result.push([last, 'run2.3']);
      return wait(100).then(() => 'done2.3');
    }, 150);

    task1.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    task2.then((last) => {
      result.push(last);
    }).catch(e => {
      result.push(e.message);
    });

    expect(result).toEqual([]);

    await wait(10);

    expect(result).toEqual(['run1.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'timeout', 'run2.1']);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'timeout', 'run2.1', ['done2.1', 'run2.2']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'timeout', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3']]);

    await wait(100);
    expect(result).toEqual(['run1.1', ['done1.1', 'run1.2'], 'timeout', 'run2.1', ['done2.1', 'run2.2'], ['done2.2', 'run2.3'], 'done2.3']);

  });

  afterEach(async () => {
  });

});
