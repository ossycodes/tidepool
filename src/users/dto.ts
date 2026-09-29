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
