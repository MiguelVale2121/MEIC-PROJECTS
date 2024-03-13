import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ObjectId } from "mongoose";

export const Client = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    return request.sessionClientId ? request.sessionClientId : undefined;
  }
);
