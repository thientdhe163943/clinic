import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { SuggestedSlotDto } from '../appointments/suggest-slots-response.dto';

export class AiChatHistoryMessageDto {
  @IsIn(['user', 'bot'])
  from!: 'user' | 'bot';

  @IsNotEmpty()
  @IsString()
  text!: string;
}

export class AiChatRequestDto {
  // Client-generated (e.g. crypto.randomUUID()) — groups all turns of one
  // widget conversation together in ai_chat_logs; not a server session id.
  @IsNotEmpty()
  @IsString()
  sessionId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  message!: string;

  // Prior turns of this conversation, oldest first — the widget keeps its
  // own local message list and resends it each turn since the API is
  // stateless. Capped client-side isn't enforced here; the use case only
  // takes the last few turns (see AI_CHAT_HISTORY_LIMIT).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatHistoryMessageDto)
  history?: AiChatHistoryMessageDto[];
}

export interface SuggestedSpecialtyDto {
  id: string;
  name: string;
}

export interface AiChatResponseDto {
  reply: string;
  suggestedSpecialties: SuggestedSpecialtyDto[];
  suggestedSlots: SuggestedSlotDto[];
  disclaimer: string;
}

export interface AiChatHistoryEntryDto {
  from: 'user' | 'bot';
  text: string;
  createdAt: string;
}
