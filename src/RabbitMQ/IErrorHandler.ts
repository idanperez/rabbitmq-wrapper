export default interface IErrorHandler<T> {
    handleError(messageFailed: T): Promise<void>;
}
