import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface IAuthUser {
  id: string;
  email: string;
  displayName: string;
  accountStatus: string;
  mfaEnabled: boolean;
  sessionId?: string;
  memberships: Array<{
    organizationId: string;
    role: string;
    status: string;
  }>;
}

export const CurrentUser = createParamDecorator(
  (data: keyof IAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as IAuthUser;

    return data ? user?.[data] : user;
  },
);
