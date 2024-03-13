import { IsBase64, IsMongoId, IsString } from "class-validator";

export class RawLoginDto {
  @IsBase64()
  data: string;

  @IsBase64()
  publicKey: string;
}

export class LoginDto {
  @IsMongoId()
  clientId: string;

  @IsString()
  password: string;
}
