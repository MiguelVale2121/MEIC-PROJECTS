import { IsString } from 'class-validator';

export class UnprotectDto {
  @IsString()
  mic: string;

  @IsString()
  nonce: string;

  @IsString()
  data: string;
}
