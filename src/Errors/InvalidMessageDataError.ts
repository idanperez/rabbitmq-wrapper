// This Exceptions says that this rabbit massage is invalid
// If it thrown, we shouled ignore this mesage(skip retry and dlx, just ack message)
export default class InvalidMessageDataError extends Error {
  __proto__: Error;
  innerError: Error;
  constructor(msg: any, error?: Error) {
    const trueProto = new.target.prototype;
    super(msg);

    if (error) {
      this.innerError = error;
    }

    this.__proto__ = trueProto;
  }
}
