import type { User } from '../generated/prisma/client.js';

export function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    digestEnabled: user.digestEnabled,
    digestDay: user.digestDay,
    digestHour: user.digestHour,
    timezone: user.timezone,
    lastDigestSentAt: user.lastDigestSentAt,
    createdAt: user.createdAt,
  };
}

export type UserResponse = ReturnType<typeof toUserResponse>;
