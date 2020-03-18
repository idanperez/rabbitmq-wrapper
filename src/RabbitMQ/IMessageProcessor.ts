export default interface IMessageProcessor<T> {
    process(message: T): Promise<void>;
}
