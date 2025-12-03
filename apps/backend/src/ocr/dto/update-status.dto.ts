import { DocStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(DocStatus)
  @IsOptional()
  status?: DocStatus = DocStatus.VERIFIED;
}
