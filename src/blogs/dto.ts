import { Type } from 'class-transformer';
import { MAX_KEYWORD_LENGTH, MAX_KEYWORDS } from '../digest/keywords.js';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  /** Only this blog's posts mentioning one of these go into digests */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_KEYWORDS)
  @IsString({ each: true })
  @MaxLength(MAX_KEYWORD_LENGTH, { each: true })
  includeKeywords?: string[];

  /** This blog's posts mentioning any of these are left out of digests */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_KEYWORDS)
  @IsString({ each: true })
  @MaxLength(MAX_KEYWORD_LENGTH, { each: true })
  excludeKeywords?: string[];

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

/** Largest batch the web app sends at once; it loops over bigger imports. */
export const IMPORT_BATCH_SIZE = 10;

export class ImportBlogsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_BATCH_SIZE)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  urls: string[];
}

export class ListPostsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
