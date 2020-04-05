import { Message, MessageProperties } from 'amqplib';
import * as opentracing from 'opentracing';
import winston, { Logger } from 'winston'
import IErrorHandler from './IErrorHandler';
import IMessageProcessor from './IMessageProcessor';
import RabbitMqMessage from './RabbitMessage';
import { RabbitMQWorkerSettings } from './RabbitMqSettings';

import InvalidMessageDataError from '../Errors/InvalidMessageDataError';
import TemporaryFailureError from '../Errors/TemporaryFailureError';

import { autoTracer } from 'autotracer';
import { RabbitMq } from './RabbitMq';

export default class RabbitMqRetryConsumerWorker<T> extends RabbitMq {
    constructor(private _workerSettings: RabbitMQWorkerSettings,
        private _messageProcessor: IMessageProcessor<T>,
        private _errorHandler: IErrorHandler<T>,
        private _logger: Logger = winston.createLogger()) {
        super(_workerSettings, _workerSettings.QueueSettings);
    }

    public async init() {
        await super.init();
        await this.intiallizeQueue(this._queueSettings);

        if (this._channel === null) {
            throw Error('Failed To create channel');
        }
        this._channel.prefetch(this._workerSettings.ParrallelMessages, true);
        this._channel.consume(this._queueSettings.QueueName, this.onMessageConsumed.bind(this),
            { noAck: false, exclusive: false });
    }

    private async onMessageConsumed(msg: Message | null) {
        if (!msg) {
            this._logger.error('Message is null - ignoring it');
            return;
        }

        await autoTracer.tracingSession().runAndReturn(async () => {
            const rabbitMessage: RabbitMqMessage<T> = this.getMessageAndRetryNumber(msg);
            if (rabbitMessage.rabbitMessage === null) {
                this._logger.error({ message: 'Failed parsing message from rabbit - ignoring it' });
                this._channel.ack(msg);
                return;
            }

            const consumedSpanData = autoTracer.startNewSpan(`Message Consumes from queue: ${this._workerSettings.QueueSettings.QueueName}`, false, rabbitMessage.spanContext);
            const consumedSpan = consumedSpanData.span;
            try {
                consumedSpan.setTag('RetryNumber', rabbitMessage.numOfFailures);
                this._logger.info({
                    message: 'Starting to work on msg',
                });

                await this._messageProcessor.process(rabbitMessage.rabbitMessage);
                this._channel.ack(msg, false);
                this._logger.info({
                    message: 'Successfully finished processing message',
                    processingMessageStatus: 'Success',
                    numberOfTriesUntilSuccess: rabbitMessage.numOfFailures + 1
                });
            } catch (e) {
                if (e instanceof InvalidMessageDataError) {
                    consumedSpan.setBaggageItem('error', 'true');
                    consumedSpan.log({ message: 'removed from queue, wont work on this message' });
                    this._logger.error({
                        err: e,
                        errInnerError: e.innerError,
                        message: 'Failed to work on message, invalid message, ignoring it',
                        processingMessageStatus: 'InvalidMessage',
                        numberOfTries: rabbitMessage.numOfFailures + 1,
                    });

                    await this._errorHandler.handleError(rabbitMessage.rabbitMessage);
                    this._channel.ack(msg, false);
                    return;
                } else if (e instanceof TemporaryFailureError) {
                    consumedSpan.setTag('failureType', 'TemporaryFailureError')
                    this._logger.warn({
                        err: e,
                        errInnerError: e.innerError,
                        message: 'Temporary error occourd, sending to dlx',
                        processingMessageStatus: 'TemporaryFailure',
                        numberOfTries: rabbitMessage.numOfFailures + 1,
                    });

                    this._channel.reject(msg, false);
                    return;
                } else {
                    if (this._workerSettings.NumberOfRetries && rabbitMessage.numOfFailures + 1 < this._workerSettings.NumberOfRetries) {
                        consumedSpan.setTag('failureType', 'General Error Occourd');
                        this._logger.warn({
                            err: e,
                            message: `Failed Working on message, failure number ${rabbitMessage.numOfFailures + 1} `,
                            processingMessageStatus: 'NormalRetry',
                            numberOfTries: rabbitMessage.numOfFailures + 1,
                        });

                        this._channel.reject(msg, false);
                        return;
                    }

                    consumedSpan.setBaggageItem('error', 'true');
                    consumedSpan.log({ message: 'Retry limit reached, Ignoring this message' });
                    this._logger.error(
                        {
                            err: e,
                            message: `Failed to work on message, tried ${rabbitMessage.numOfFailures + 1} than the max number of retries: ${this._workerSettings.NumberOfRetries}, ignoring it`,
                            processingMessageStatus: 'MaximumRetriesReached',
                            numberOfTries: rabbitMessage.numOfFailures + 1,
                        });

                    await this._errorHandler.handleError(rabbitMessage.rabbitMessage);
                    this._channel.ack(msg, false);
                }
            } finally {
                consumedSpanData.finish();
            }
        });
    }

    private getMessageAndRetryNumber(msg: Message): RabbitMqMessage<T> {
        const rabbitMsg: RabbitMqMessage<T> = { rabbitMessage: null, numOfFailures: 0 };
        try {
            rabbitMsg.rabbitMessage = JSON.parse(msg.content.toString());
        } catch (e) {
            return rabbitMsg;
        }

        rabbitMsg.numOfFailures = this.getRetryNumberFromMessageHeader(msg.properties);
        rabbitMsg.spanContext = this.getTracingSpanFromMessage(msg.properties);

        return rabbitMsg;
    }

    private getRetryNumberFromMessageHeader(properties: MessageProperties): number {
        if (!properties.headers || !('x-death' in properties.headers)) { return 0; }

        const xDeathFieldList = properties.headers['x-death'];
        if (xDeathFieldList === null || xDeathFieldList === undefined) { return 0; }

        for (const field of xDeathFieldList) {
            if (field.reason === 'rejected') {
                return field.count;
            }
        }
        return 0;
    }

    private getTracingSpanFromMessage(properties: MessageProperties): opentracing.SpanContext {
        const globalTracer = opentracing.globalTracer();
        if (!properties.headers || !globalTracer || !('uber-trace-id' in properties.headers)) {
            return null;
        }

        if (properties.headers['uber-trace-id'] === undefined) {
            return null;
        }

        const parentSpan = globalTracer.extract(opentracing.FORMAT_HTTP_HEADERS, properties.headers);
        return parentSpan;
    }
}
