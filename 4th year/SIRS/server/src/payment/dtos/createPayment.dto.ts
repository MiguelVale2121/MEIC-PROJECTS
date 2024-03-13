import {
  IsDateString,
  IsMongoId,
  IsNegative,
  IsNumber,
  IsString,
} from "class-validator";

export class CreatePaymentDto {
  @IsDateString()
  date: string;

  @IsString()
  entity: string;

  @IsNegative()
  amount: number;

  @IsString()
  description: string;

  @IsMongoId()
  accountId: string;
}
