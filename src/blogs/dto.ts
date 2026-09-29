import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddBlogDto {
  /** Blog homepage or feed URL; the scheme is optional */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url: string;
}

export class UpdateBlogDto {
  /** Your own name for the blog; null or "" restores the original */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  /** Keep following, but leave it out of your digests */
  @IsOptional()
  @IsBoolean()
  paused?: boolean;
}

export class ListPostsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
