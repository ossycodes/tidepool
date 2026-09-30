import type { User } from '../generated/prisma/client.js';

export function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    digestEnabled: user.digestEnabled,
    digestDay: user.digestDay,
    digestHour: user.digestHour,
    digestFrequency: user.digestFrequency,
    digestMinPosts: user.digestMinPosts,
    mutedKeywords: user.mutedKeywords,
    timezone: user.timezone,
    /** Slug for the public /shared/:id page; null while sharing is off */
    shareId: user.shareId,
    lastDigestSentAt: user.lastDigestSentAt,
    createdAt: user.createdAt,
  };
}

export type UserResponse = ReturnType<typeof toUserResponse>;
