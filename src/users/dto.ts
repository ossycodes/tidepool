import { MAX_KEYWORD_LENGTH, MAX_KEYWORDS } from '../digest/keywords.js';
import { DigestFrequency } from '../generated/prisma/client.js';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsTimeZone,
  IsString,
  Max,
  MaxLength,
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

  /** Posts mentioning any of these are left out of every digest. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_KEYWORDS)
  @IsString({ each: true })
  @MaxLength(MAX_KEYWORD_LENGTH, { each: true })
  mutedKeywords?: string[];
}

export class ShareDto {
  /** Replace the current link with a new one, so the old link stops working. */
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
