import {
  IsBoolean,
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
}

export class ShareDto {
  /** Replace the current link with a new one, so the old link stops working. */
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
