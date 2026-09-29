import { Type } from 'class-transformer';
import {
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

export class ListPostsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
