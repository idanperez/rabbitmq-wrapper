import { autoTracer } from 'autotracer';
import IErrorHandler from '../src/RabbitMQ/IErrorHandler';
import { TestMessage } from './message';

export class ErrorHandler implements IErrorHandler<TestMessage> {
    constructor() {
        this.notAsync = this.notAsync.bind(this);
        this.handleError = this.handleError.bind(this);
    }

    @autoTracer.autoTraceAsyncFunction('handle Error')
    public handleError(messageFailed: TestMessage): Promise<void> {
        autoTracer.getActiveSpan().span.setTag('error', true);
        this.notAsync();
        return new Promise((resolve) => {
            console.error('Failed On Message, message is :' + messageFailed.dummyMessage);
            resolve();
        });
    }

    @autoTracer.autoTraceSyncFunction('not async Error')
    public notAsync() {
        console.log('sadsdsa');
    }
}
