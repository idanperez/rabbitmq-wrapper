export interface RabbitMQSettings {
     Uri: string;
     ExchangeName: string;
}

export interface RabbitMQSenderSettings extends RabbitMQSettings {
     Routings?: string[];
}

export interface QueueSettings {
     ExchangeName: string;
     ExchangeType: ExchangeType;
     QueueName: string;
     RoutingKeys?: string[];
     HasDlx: boolean;
}

export interface RabbitMQWorkerSettings extends RabbitMQSettings {
     NumberOfRetries?: number;
     ParrallelMessages: number;
     QueueSettings : QueueSettings;
}

type ExchangeType = 'topic' | 'direct' | 'fanout';
