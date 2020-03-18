import * as opentracing from 'opentracing';

export default interface RabbitMqMessage<T> {
    rabbitMessage: T | null;
    numOfFailures: number;
    spanContext?: opentracing.SpanContext;
}
