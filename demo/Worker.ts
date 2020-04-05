import { delay } from 'bluebird';
import InvalidMessageDataError from '../src/Errors/InvalidMessageDataError';
import TemporaryFailureError from '../src/Errors/TemporaryFailureError';
import IMessageProcessor from '../src/RabbitMQ/IMessageProcessor';
import { autoTracer } from 'autotracer';
import { TestMessage } from './message';

export class Worker implements IMessageProcessor<TestMessage> {
    public async process(messageFailed: TestMessage): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const spandata = autoTracer.startNewSpan('in a process span');
            spandata.finish();

            const fakeMsk = 'dummy message to return';
            let message = await this.traceasyncReturns(fakeMsk);
            if (message !== fakeMsk) {
                throw new Error('tracing on async method that return value doesnt work');
            }

            message = await this.traceSyncReturns(fakeMsk);
            if (message !== fakeMsk) {
                throw new Error('tracing on sync method that return value doesnt work');
            }

            try {
                await this.traceasyncThrows();
                console.log('Did not throw the error of A-Sync!!!! !!!')
            } catch (error) {
                console.log('catched error of async');
            }

            try {
                this.syncThatThrows()
                console.log('Did not throw the error of Sync!!!! !!!')
            } catch (err) {
                console.log('error of sync catched');
            }

            if (messageFailed.dummyMessage === 'failed') {
                return reject(new Error('Failed Intentional'));
            } else if (messageFailed.dummyMessage === 'tempFailed') {
                return reject(new TemporaryFailureError('Failed Intentional', new Error('oopsssss')));
            } else if (messageFailed.dummyMessage === 'InvalidFailed') {
                return reject(new InvalidMessageDataError('Failed Intentional'));
            }
            resolve();
        });
    }

    @autoTracer.autoTraceSyncFunction('trace sync that throws')
    public syncThatThrows() {
        throw new Error();
    }

    @autoTracer.autoTraceSyncFunction('trace sync that return')
    public traceSyncReturns(msg: string) {
        return msg;
    }

    @autoTracer.autoTraceAsyncFunction('trace async that throws')
    public async traceasyncThrows() {
        await delay(1000);
        throw new Error();
    }

    @autoTracer.autoTraceAsyncFunction('trace async that returns')
    public async traceasyncReturns(msg: string) {
        await delay(1000);
        return msg;
    }
}
