export interface WorkerErrorOpts {
  ignore: boolean;
}

export class WorkerError extends Error {
  opts?: WorkerErrorOpts | undefined;
  constructor(message: string, opts?: WorkerErrorOpts) {
    super(message);
    this.opts = opts;
  }
}
