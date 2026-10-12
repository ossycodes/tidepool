import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  ValidateIf,
  Matches,
  IsString,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
} from 'class-validator';
import { ReadingStatus } from '../generated/prisma/client.js';

export class StateDto {
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() saved?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  favourite?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ReadingStatus)
  status?: ReadingStatus;
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(1)
  progress?: number;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(30)
  @Matches(/^p\d+$/)
  paragraph?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  collectionIds?: string[];
}
export class CollectionDto {
  @IsString() @MaxLength(80) name!: string;
}
export class AnnotationDto {
  @IsString()
  @MaxLength(30)
  @Matches(/^p\d+$/)
  paragraph!: string;
  @IsString() @MaxLength(4000) quote!: string;
  @IsInt() @Min(0) start!: number;
  @IsInt() @Min(1) end!: number;
  @IsString() @MaxLength(64) version!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(4000)
  note?: string;
}
export class NoteDto {
  @IsString() @MaxLength(4000) note!: string;
}
export class AskDto {
  @IsString() @MaxLength(2000) question!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  annotationId?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum({ quick: 'quick', deep: 'deep' })
  mode?: 'quick' | 'deep';
}
