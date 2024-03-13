import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createPublicKey } from "crypto";

import { InjectModel } from "@nestjs/mongoose";

import { Model, ObjectId, Types, Document } from "mongoose";
import { DateTime } from "luxon";
import { CreatePaymentDto } from "./dtos/createPayment.dto";
import { HolderSignature, Payment } from "./schemas/payment.schema";
import { checkSignature } from "@securelib";
import { AuthorizePaymentDto } from "./dtos/authorizePayment.dto";
import { Session } from "src/client/schemas/client.schema";
import { AccountService } from "src/account/account.service";
import { CreateAccountMovementDto } from "src/account/dtos/createMovement.dto";
import { Account } from "src/account/schemas/account.schema";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    private readonly accountService: AccountService
  ) {}

  // Auxiliary functions

  private checkHolderSignature(
    holderSignature: HolderSignature,
    paymentId: string
  ): boolean {
    const publicKeyObject = createPublicKey({
      key: Buffer.from(holderSignature.publicKey, "base64"),
      format: "pem",
      type: "spki",
    });

    return checkSignature(
      {
        clientId: holderSignature.clientId,
        paymentId: paymentId,
      },
      holderSignature.signature,
      publicKeyObject
    );
  }

  private checkPaymentSignatures(
    paymentId: string,
    payment: Document<unknown, {}, Payment> &
      Payment & {
        _id: Types.ObjectId;
      }
  ): boolean {
    const verifiedHolders = new Set<string>();
    const accountHolders = new Set<string>();

    payment.account[0].holders.forEach((holder: ObjectId) =>
      accountHolders.add(holder.toString())
    );

    payment.holdersSignatures.forEach((signature) => {
      if (this.checkHolderSignature(signature, paymentId)) {
        verifiedHolders.add(signature.clientId);
      }
    });

    return (
      accountHolders.size === verifiedHolders.size &&
      [...verifiedHolders].every((x) => accountHolders.has(x))
    );
  }

  // Exposed functions

  async findPayment(clientId: string, paymentId: string) {
    const payment = await this.paymentModel
      .findById(paymentId)
      .populate("account")
      .exec();

    if (!payment) throw new NotFoundException("Payment not found");

    const holdersIds = payment.account[0].holders.map((holder: ObjectId) =>
      holder.toString()
    );

    if (!holdersIds.includes(clientId)) throw new ForbiddenException();

    return payment;
  }

  async createPayment(clientId: string, createPaymentDto: CreatePaymentDto) {
    this.logger.verbose(`Attempting to create a payment...\n`);
    const account = await this.accountService.findAccount(
      clientId,
      createPaymentDto.accountId
    );
    this.logger.verbose(`Checking if funds are sufficient...\n`);
    if (account.balance + createPaymentDto.amount < 0)
      throw new BadRequestException("Insufficient funds");
    this.logger.verbose(`Checking if date is valid...\n`);
    if (
      DateTime.now().toMillis() -
        DateTime.fromISO(createPaymentDto.date).toMillis() <
      0
    )
      throw new BadRequestException("Invalid Date");

    const payment = new this.paymentModel({
      date: DateTime.fromISO(createPaymentDto.date),
      entity: createPaymentDto.entity,
      amount: createPaymentDto.amount,
      description: createPaymentDto.description,
      account: account,
    });

    account.paymentOrders.push(payment);

    await Promise.all([account.save(), payment.save()]);
    this.logger.verbose(`Payment successfully created:\n ${payment}`);
    return payment;
  }

  async getPendingPayments(
    clientId: string,
    accountId: string
  ): Promise<Payment[]> {
    const account = await this.accountService.findAccount(clientId, accountId);
    const accountWithPayments = await account.populate("paymentOrders");

    return accountWithPayments.paymentOrders.filter(
      (payment) => !payment.completed
    );
  }

  async authorizePayment(
    sessionId: string,
    clientId: string,
    authorizePaymentDto: AuthorizePaymentDto
  ) {
    this.logger.verbose("Received:", authorizePaymentDto);

    this.logger.verbose("Checking payment...");

    const payment = await this.findPayment(
      clientId,
      authorizePaymentDto.paymentId
    );

    this.logger.verbose(`Payment: ${payment._id}`);

    if (payment.completed)
      throw new BadRequestException("This payment was already processed");

    const session = await this.sessionModel.findById(sessionId).exec();

    this.logger.verbose("Creating exclusive device signature object...");

    const holderSignature: HolderSignature = {
      clientId: clientId,
      publicKey: session.publicKey,
      signature: authorizePaymentDto.signature,
    };

    this.logger.verbose("Checking signature...");
    if (
      !this.checkHolderSignature(holderSignature, authorizePaymentDto.paymentId)
    )
      throw new BadRequestException("Signatures don't match");

    this.logger.verbose(
      `Added signature: (Payment: ${payment._id}) <== (Client: ${clientId})`
    );
    payment.holdersSignatures.push(holderSignature);
    await payment.save();

    if (this.checkPaymentSignatures(authorizePaymentDto.paymentId, payment)) {
      this.logger.log(`Processing payment ${authorizePaymentDto.paymentId}`);
      await this.processPayment(payment);
    }

    return payment;
  }

  async processPayment(
    payment: Document<unknown, {}, Payment> &
      Payment & {
        _id: Types.ObjectId;
      }
  ) {
    this.logger.verbose(`Processing payment...\n`);

    this.logger.verbose(`Checking if funds are sufficient...\n`);
    if (payment.account.balance + payment.amount < 0)
      throw new BadRequestException("Insufficient funds");

    const account = await this.accountModel.findById(payment.account[0]._id);
    const createMovementDto = new CreateAccountMovementDto();
    createMovementDto.date = payment.date;
    createMovementDto.amount = payment.amount;
    createMovementDto.description = payment.description;

    const movement = this.accountService.createMovement(
      account,
      createMovementDto
    );
    this.logger.verbose("Movement created:", movement);
    payment.completed = true;
    this.logger.verbose("Payment updated:", payment);
    await Promise.all([movement.save(), account.save(), payment.save()]);
  }
}
