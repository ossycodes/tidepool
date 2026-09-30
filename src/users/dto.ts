import { DigestFrequency } from '../generated/prisma/client.js';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsTimeZone,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  /** 0 = Sunday ... 6 = Saturday */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  digestDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsEnum(DigestFrequency)
  digestFrequency?: DigestFrequency;

  /** Hold the digest until at least this many new posts have piled up. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  digestMinPosts?: number;
}

export class ShareDto {
  /** Replace the current link with a new one, so the old link stops working. */
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
