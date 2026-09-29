import {
  IsEmail,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  MaxLength,
} from 'class-validator';

export class RequestMagicLinkDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyMagicLinkDto {
  @IsString()
  @Length(20, 200)
  token: string;

  /** Browser timezone, applied only when the account is first created. */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
