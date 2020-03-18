import RabbitMqRetryConsumerWorker from './src/RabbitMQ/RabbitMqRetryConsumerWorker';
import RabbitMqSender from './src/RabbitMQ/RabbitMqSender';
import { QueueSettings, RabbitMQSettings, RabbitMQWorkerSettings } from './src/RabbitMQ/RabbitMqSettings';
import { ErrorHandler } from './RabbitMqTests/ErrorHandler';
import { TestMessage } from './RabbitMqTests/message';
import { Worker } from './RabbitMqTests/Worker';

// import getTracer, { wrapAutoTracer } from './Tracing/InitTracer';
// const loggerSettings: LoggerSettings = {
//     consoleLevel: 'info',
//     environment: 'TrumpTests',
//     name: '4rabbitmq-test',
//     project: '4rabbitmq-test',
//     service: '4rabbitmq-test',
//     LogStashSettings: {
//         host: 'LogStashHostAdress',
//         port: 8085,
//         logLevel: 'info',
//         protocol: 'tcp',
//     },
// };

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
