import RabbitMqRetryConsumerWorker from './src/RabbitMQ/RabbitMqRetryConsumerWorker';
import RabbitMqSender from './src/RabbitMQ/RabbitMqSender';
import { QueueSettings, RabbitMQSettings, RabbitMQWorkerSettings } from './src/RabbitMQ/RabbitMqSettings';
import { ErrorHandler } from './demo/ErrorHandler';
import { TestMessage } from './demo/message';
import { Worker } from './demo/Worker';

import winston from 'winston';
import { parseErrors } from './src/Logs/log-parser';
import { TemporaryFailureError } from '.';

const logger = winston.createLogger({
    format: winston.format.combine(
        parseErrors(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.Http({
            host: 'localhost', port: 5002
        }),
    ]
});
logger.info('with please error parsed', { err: new TemporaryFailureError("fuck, this is main!", new Error("this is ineer, hope it works")), anotherParams: { idk: 'works' } });

// LegoLogger.setSettings({
//     consoleLevel: 'info', environment: 'prod', name: 'fuck', project: 'idans', service: 'why so many params ? ', LogStashSettings: {
//         host: 'localhost',
//         logLevel: 'info',
//         port: 5000,
//         protocol: 'udp'
//     }
// })

let settings: RabbitMQSettings;
settings = {
    Uri: 'amqp://RabbitMqURI',
    ExchangeName: 'jaeger',
};
const sender: RabbitMqSender = new RabbitMqSender({ ...settings });
const queueSettings: QueueSettings = {
    HasDlx: true,
    ExchangeName: 'test-exchange',
    QueueName: 'test-queue',
    ExchangeType: 'direct',
    RoutingKeys: ['A', 'B.C'],
};

const consumerSettings: RabbitMQWorkerSettings = {
    ...settings, NumberOfRetries: 5, ParrallelMessages: 5,
    QueueSettings: queueSettings,
};

const worker = new RabbitMqRetryConsumerWorker(consumerSettings,
    new Worker(),
    new ErrorHandler());

// getTracer({ agentHostName: 'agentHostName', serviceName: 'test' });
worker.init().then(() => {
    sender.init().then(() => {
        sender.publishMessage<TestMessage>({ dummyMessage: 'InvalidFailed' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
    }).catch((err) => console.log(err));
}).catch((err) => console.log(err));
