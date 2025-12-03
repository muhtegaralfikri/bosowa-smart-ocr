import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsString()
  letterNo?: string;

  @IsOptional()
  @IsString()
  docDate?: string;

  @IsOptional()
  @IsString()
  sender?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  rawOcr?: unknown;
}
