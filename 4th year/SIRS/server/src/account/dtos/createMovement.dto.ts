import { IsString, IsNumber, IsDateString } from "class-validator";

export class CreateAccountMovementDto {
  @IsDateString()
  date: string;

  @IsNumber()
  amount: number;

  @IsString()
  description: string;
}
