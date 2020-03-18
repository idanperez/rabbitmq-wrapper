// This Exception came to say that error occurred, but its  temporary - maybe a service that we need it signals us that 
// The request might have been working but one of our dependencies is down - therefor we need to wait and try again if we can
export default class TemporaryFailureError extends Error {
    __proto__: Error;
    innerError?: Error;
    constructor(msg: any, error?: Error) {
        const trueProto = new.target.prototype;
        super(msg);

        if (error) {
            this.innerError = error;
        }

        this.__proto__ = trueProto;
    }
}