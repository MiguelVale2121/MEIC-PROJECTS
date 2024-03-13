import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { DateTime } from "luxon";
import mongoose, { HydratedDocument } from "mongoose";
import { Account } from "src/account/schemas/account.schema";
import { AccountMovement } from "src/account/schemas/movement.schema";

export type PaymentHydrated = HydratedDocument<Payment>;

export interface HolderSignature {
  clientId: string;
  publicKey: string;
  signature: string;
}

@Schema()
export class Payment {
  @Prop()
  date: string;

  @Prop()
  entity: string;

  @Prop()
  amount: number;

  @Prop()
  description: string;

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }])
  account: Account;

  @Prop()
  holdersSignatures: HolderSignature[];

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: "AccountMovement" }])
  movement?: AccountMovement;

  @Prop()
  completed: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
