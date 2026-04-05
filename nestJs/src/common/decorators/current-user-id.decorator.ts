import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  userId?: string;
};

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.userId ?? null;
  },
);

