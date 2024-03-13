import { IsBase64 } from "class-validator";

export class SecureData {
  @IsBase64()
  data: string;
}
