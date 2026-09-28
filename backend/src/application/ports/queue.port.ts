export interface QueuePort {
  publish<TPayload extends object>(queueName: string, jobName: string, payload: TPayload): Promise<void>;
}
