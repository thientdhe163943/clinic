import { apiClient, unwrap } from '../client';

export interface MessageDto {
  messageCode: string;
  message: string;
}

export const messagesApi = {
  findOne(code: string) {
    return unwrap<MessageDto>(apiClient.get(`/messages/${code}`));
  },
};
