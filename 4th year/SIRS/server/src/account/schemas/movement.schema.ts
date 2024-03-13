import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { Payment } from "src/payment/schemas/payment.schema";
import { Account } from "./account.schema";
import { DateTime } from "luxon";

@Schema()
export class AccountMovement {
  @Prop()
  date: string;

  @Prop()
  amount: number;

  @Prop()
  description: string;

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }])
  account: Account;

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: Payment.name }])
  paymentOrder?: Payment;
}

export type AccountMovementHydrated = HydratedDocument<AccountMovement>;
export const AccountMovementSchema =
  SchemaFactory.createForClass(AccountMovement);
