import { PaymentService } from "./payment.service";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";

import { CreatePaymentDto } from "./dtos/createPayment.dto";
import { SecureDataInterceptor } from "src/interceptors/securedata.interceptor";
import { Client } from "src/decorators/client.decorator";
import { AuthorizePaymentDto } from "./dtos/authorizePayment.dto";

@Controller("payments")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseInterceptors(SecureDataInterceptor)
  async createPayment(
    @Client() clientId: string,
    @Body(ValidationPipe) createPaymentDto: CreatePaymentDto
  ) {
    return this.paymentService.createPayment(clientId, createPaymentDto);
  }

  @Get(":paymentId")
  @UseInterceptors(SecureDataInterceptor)
  async findPayment(
    @Client() clientId: string,
    @Param("paymentId") paymentId: string
  ) {
    return await this.paymentService.findPayment(clientId, paymentId);
  }

  @Get("pending/:accountId")
  @UseInterceptors(SecureDataInterceptor)
  async getPendingPayments(
    @Client() clientId: string,
    @Param("accountId") accountId: string
  ) {
    return await this.paymentService.getPendingPayments(clientId, accountId);
  }

  @Post("authorize")
  @UseInterceptors(SecureDataInterceptor)
  async authorizePayment(
    @Headers("session-id") sessionId: string,
    @Client() clientId: string,
    @Body(ValidationPipe) authorizePaymentDto: AuthorizePaymentDto
  ) {
    return await this.paymentService.authorizePayment(
      sessionId,
      clientId,
      authorizePaymentDto
    );
  }
}
