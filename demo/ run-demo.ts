// library imports
import RabbitMqRetryConsumerWorker from '../src/RabbitMQ/RabbitMqRetryConsumerWorker';
import RabbitMqSender from '../src/RabbitMQ/RabbitMqSender';
import { QueueSettings, RabbitMQSettings, RabbitMQWorkerSettings } from '../src/RabbitMQ/RabbitMqSettings';

// own implementations
import { ErrorHandler } from './error-handler';
import { TestMessage } from './message';
import { Worker } from './demo-worker';

// logs
import winston from 'winston';
import { parseErrors } from '../src/Logs/log-parser';

// import {getTracer} from 'autotracer';


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
    new ErrorHandler(),
    logger);

// getTracer({ agentHostName: 'agentHostName', serviceName: 'test' });
worker.init().then(() => {
    sender.init().then(() => {
        sender.publishMessage<TestMessage>({ dummyMessage: 'InvalidFailed' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
        sender.publishMessage<TestMessage>({ dummyMessage: 'regular' }, 'A');
    }).catch((err) => console.log(err));
}).catch((err) => console.log(err));
