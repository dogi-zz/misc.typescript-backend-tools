// interface MutexSchedulerTaskStep {
//   callback: (lastResult: any) => any;
// }

export class MutexChainSingleTask {

  public static perform<T, O>(promise: Promise<T>, thenCallback: (item: T) => O, timeout: number, isSillActive?: () => boolean, timeoutError?: Error): Promise<O> {
    timeoutError = timeoutError ?? new Error('timeout');
    return new Promise<O>((res, rej) => {
      let hadTimeout = false;
      const to = setTimeout(() => {
        hadTimeout = true;
        rej(timeoutError);
      }, timeout);
      promise.then(result => {
        clearTimeout(to);
        if (!hadTimeout && (!isSillActive || isSillActive())) {
          try {
            const callbackResult = thenCallback(result);
            res(callbackResult);
          } catch (e) {
            rej(e);
          }
        }
      }).catch(e => {
        clearTimeout(to);
        rej(e);
      });
    });

  }

}


interface MutexChainTaskChainer<I> {
  addStep<O>(step: (last: I) => Promise<O> | MutexChainTaskChainer<any>, time: number): MutexChainTaskChainer<O>;
}

export class MutexChainTask {

  private stepList: { step: (last: any) => Promise<any> | MutexChainTaskChainer<any>, timeOutTime: number, timeoutError: Error }[] = [];
  private isRunning = false;
  private isDone = false;

  private lastResult: any;

  private promiseRes: () => void;
  private promiseRej: (error: any) => void;
  private promise: Promise<any> = new Promise((res, rej) => {
    this.promiseRes = res;
    this.promiseRej = rej;
  });

  constructor(
      private mutexChain: MutexChain,
  ) {
  }

  public addStep<O>(step: (last: any) => Promise<O> | MutexChainTaskChainer<any>, timeOutTime: number): MutexChainTaskChainer<O> {
    const timeoutError = new Error('timeout');
    if (this.isRunning) {
      const newTask = new MutexChainTask(this.mutexChain);
      newTask.stepList.push({step, timeOutTime, timeoutError});
      return newTask;
    } else {
      this.stepList.push({step, timeOutTime, timeoutError});
      return this;
    }
  }

  public then<T>(callback: (value: any) => T): Promise<T> {
    return this.promise.then(() => callback(this.lastResult));
  }

  public start() {
    if (this.mutexChain._startedTask !== this) {
      throw new Error('Cant start Task manually');
    }
    if (this.isRunning) {
      throw new Error('Cant start Task twice');
    }
    if (this.isDone) {
      throw new Error('Task is already done');
    }
    this.isRunning = true;
    this.runStep();
  }

  private runStep() {
    if (!this.stepList.length) {
      this.isRunning = false;
      this.isDone = true;
      setTimeout(() => {
        this.mutexChain._continue();
      });
      this.promiseRes();
      return;
    }
    const {step, timeOutTime, timeoutError} = this.stepList.shift();
    let promiseOrTask: any;
    try {
      promiseOrTask = step(this.lastResult);
      if (promiseOrTask instanceof Promise) {
        MutexChainSingleTask.perform(promiseOrTask, res => {
          this.lastResult = res;
        }, timeOutTime, () => !this.mutexChain.isStopped, timeoutError).then(() => {
          this.runStep();
        }).catch(e => {
          this.isRunning = false;
          this.isDone = true;
          setTimeout(() => {
            this.mutexChain._continue();
          });
          this.promiseRej(e);
        });
      } else {
        if (promiseOrTask === this) {
          throw new Error('Invalid result: task cannot return itself');
        }
        this.lastResult = undefined;
        this.stepList = [...promiseOrTask.stepList, ...this.stepList];
        this.runStep();
      }
    } catch (e) {
      this.isRunning = false;
      this.isDone = true;
      setTimeout(() => {
        this.mutexChain._continue();
      });
      this.promiseRej(e);
    }
  }
}


export class MutexChain {
  //
  // public runningTask: MutexSchedulerTask;
  public taskList: MutexChainTask[] = [];

  public _startedTask: MutexChainTask;

  public isStopped = false;

  public addTask() {
    if (this.isStopped) {
      return;
    }
    const newTask = new MutexChainTask(this);
    this.taskList.push(newTask);
    if (this.taskList.length === 1) {
      setTimeout(() => {
        this._startedTask = this.taskList[0];
        this.taskList[0].start();
        this._startedTask = null;
      });
    }
    return newTask;
  }

  public _continue() {
    if (this.isStopped) {
      return;
    }
    this.taskList.shift();
    if (this.taskList.length > 0) {
      this._startedTask = this.taskList[0];
      this.taskList[0].start();
      this._startedTask = null;
    }
  }

  public stop() {
    this.isStopped = true;
  }
}
