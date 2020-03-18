
import { Options } from 'amqplib';
import * as opentracing from 'opentracing';
import { autoSpan } from 'autotracer';
import { autoTracer } from 'autotracer'

import { IQueueSender } from './IQueueSender'
import { RabbitMq } from './RabbitMq';
import { RabbitMQSenderSettings } from './RabbitMqSettings';


export default class RabbitMqSender extends RabbitMq implements IQueueSender {
    private _senderSettings: RabbitMQSenderSettings;

    constructor(settings: RabbitMQSenderSettings) {
        super(settings);
        this._senderSettings = settings;
    }

    public publishMessage<T>(message: T, routing?: string): void {
        const bufferMessage = this.getMessageBuffer(message);
        if (!routing || routing === null || routing === undefined) {
            routing = this._senderSettings.Routings[0];
        }
        autoTracer.tracingSession().run(() => {
            const tracedMessageOptions = this.addTrace(routing);
            if (this._channel !== null) {
                this._channel.publish(this._senderSettings.ExchangeName, routing, bufferMessage, tracedMessageOptions.publishOptions);
            }

            if (tracedMessageOptions.span !== null) {
                tracedMessageOptions.span.finish();
            }
        });
    }

    public publishMessageToAllRoutings<T>(message: T): void {
        this.publishMessageToRoutings(message, this._senderSettings.Routings);
    }

    public publishMessageToRoutings<T>(message: T, routings: string[]): void {
        autoTracer.tracingSession().run(() => {

            const bufferMessage = this.getMessageBuffer(message);
            const tracedMessageOptions = this.addMultiRoutesTrace(routings);

            for (const routing of routings) {
                this._channel.publish(this._senderSettings.ExchangeName, routing, bufferMessage, tracedMessageOptions.publishOptions);
            }

            if (tracedMessageOptions.span !== null) {
                tracedMessageOptions.span.finish();
            }
        });
    }

    private getMessageBuffer<T>(message: T): Buffer {
        let messageAsString: string;
        if (typeof message !== 'string') {
            messageAsString = JSON.stringify(message);
        } else {
            messageAsString = message;
        }

        const bufferMessage = Buffer.from(messageAsString);
        return bufferMessage;
    }

    private addMultiRoutesTrace(routings: string[]): TracedMessageOptions {
        const allRoutes: string = routings.join(',');
        return this.addTrace(allRoutes);
    }

    private addTrace(routing: string): TracedMessageOptions {
        const tracer = opentracing.globalTracer();
        if (!tracer) return { publishOptions: { persistent: true }, span: null };

        const carrier = {};
        const publishSpan: autoSpan = autoTracer.startNewSpan(`Published to ${routing}`);
        tracer.inject(publishSpan.context(), opentracing.FORMAT_HTTP_HEADERS, carrier);

        return {
            span: publishSpan,
            publishOptions: {
                persistent: true,
                headers: carrier
            },
        };
    }
}

interface TracedMessageOptions {
    publishOptions: Options.Publish;
    span?: autoSpan;
}