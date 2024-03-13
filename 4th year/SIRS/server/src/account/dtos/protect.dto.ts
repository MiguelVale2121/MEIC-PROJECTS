import { IsArray, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

interface AccountMovement {
  date: string;
  value: number;
  description: string;
}

export class ProtectDto {
  @IsArray()
  accountHolder: string[];

  @IsNumber()
  balance: number;

  @IsNotEmpty()
  currency: 'EUR' | 'USD' | 'AED' | 'CHF' | 'BRL' | 'GBP';

  @IsOptional()
  @IsArray()
  movement: AccountMovement[];
}
