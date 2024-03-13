import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { Client } from "../../client/schemas/client.schema";
import { AccountMovement } from "./movement.schema";
import { Payment } from "src/payment/schemas/payment.schema";

export type AccountHydrated = HydratedDocument<Account>;

@Schema()
export class Account {
  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: Client.name }])
  holders: Client[];

  @Prop({ default: 0 })
  balance: number;

  @Prop()
  currency: "EUR" | "USD" | "AED" | "CHF" | "BRL" | "GBP";

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: Payment.name }])
  paymentOrders: Payment[];

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: AccountMovement.name }])
  movements: AccountMovement[];
}

export const AccountSchema = SchemaFactory.createForClass(Account);
