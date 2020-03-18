import * as opentracing from 'opentracing';

export interface IQueueSender {
     publishMessage<T>(message: T, routing?: string, activeSpan?: opentracing.SpanContext): void;
     publishMessageToAllRoutings<T>(message: T, activeSpan?: opentracing.SpanContext): void;
     publishMessageToRoutings<T>(message: T, routings: string[], activeSpan?: opentracing.SpanContext): void;
}
