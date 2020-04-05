import { ConfirmChannel } from 'amqplib';
import * as amqp from 'amqplib/callback_api';
import { QueueSettings, RabbitMQSettings } from './RabbitMqSettings';

export class RabbitMq {
    protected _channel!: amqp.Channel | null;
    protected _queueSettings: QueueSettings;
    private _settings: RabbitMQSettings;
    private RETRY_DELAY: number = 5000;

    constructor(settings: RabbitMQSettings, queueSettings?: QueueSettings) {
        this._settings = settings;
        this._queueSettings = queueSettings;
    }

    public async init() {
        if (this._channel) { return; }

        const settings = this._settings;
        const channel = await new Promise<ConfirmChannel>((resolve, reject) => {
            amqp.connect(settings.Uri, (err, conn) => {
                if (err) {
                    reject(err);
                }
                conn.createConfirmChannel((err, channel) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(channel as ConfirmChannel);
                });
            });
        });

        this._channel = channel;
    }

    public async intiallizeQueue(queueSettings: QueueSettings) {
        if (!queueSettings) {
            throw new Error('Failed initializing queue, QueueSettings invalid');
        }
        if (!queueSettings.QueueName) {
            throw new Error('Failed to Intialiize rabbit, Queue name is missing');
        }

        if (!queueSettings.ExchangeName) {
            throw new Error('Failed to Intialiize rabbit, Exchange name is missing');
        }

        await this.assertExchangeAndQueue(queueSettings.ExchangeName, queueSettings.ExchangeType, queueSettings.QueueName, queueSettings.HasDlx, queueSettings.RoutingKeys);
    }

    private async assertExchangeAndQueue(exchangeName: string, exchangeType: string, qName: string, hasDlx: boolean, routingKeys?: string[]) {
        const assertQOptions: amqp.Options.AssertQueue = { durable: true, exclusive: false, autoDelete: false };
        const assertDlxQOptions: amqp.Options.AssertQueue = { durable: true, exclusive: false, autoDelete: false };
        let dlxQueueName: string = '';
        let dlxQExchangeName: string = '';
        if (hasDlx) {
            dlxQueueName = qName + '-dlx';
            dlxQExchangeName = exchangeName + '-dlx';
            assertQOptions.deadLetterRoutingKey = dlxQueueName;
            assertQOptions.deadLetterExchange = dlxQExchangeName;
            assertDlxQOptions.deadLetterExchange = exchangeName;
            assertDlxQOptions.deadLetterRoutingKey = dlxQueueName;
            assertDlxQOptions.messageTtl = this.RETRY_DELAY;
            routingKeys = [...routingKeys, dlxQueueName]
        }

        if (!this._channel) {
            throw new Error('Failed Creating rabbitmq channel');
        }

        await this.createExchangeAndQueue(exchangeName, exchangeType, qName, assertQOptions, routingKeys);
        if (hasDlx) {
            await this.createExchangeAndQueue(dlxQExchangeName, exchangeType, dlxQueueName, assertDlxQOptions, [dlxQueueName]);
        }
    }

    private async createExchangeAndQueue(exchangeName: string, exchangeType: string, qName: string, options: amqp.Options.AssertQueue, roututingKey?: string[]) {
        return new Promise((resolve, reject) => {
            if (!this._channel) {
                reject(new Error('Channel to rabbitmq not established'));
            }

            this._channel.assertExchange(exchangeName, exchangeType, { durable: true }, (err: any) => {
                if (err) {
                    reject(err);
                }
                this._channel.assertQueue(qName, options, (err: any) => {
                    if (err) {
                        reject(err);
                    }
                    if (!roututingKey) {
                        this._channel.bindQueue(qName, exchangeName, undefined);
                    } else {
                        for (const routing of roututingKey) {
                            this._channel.bindQueue(qName, exchangeName, routing);
                        }
                    }
                    resolve();
                });
            });
        });
    }
}
