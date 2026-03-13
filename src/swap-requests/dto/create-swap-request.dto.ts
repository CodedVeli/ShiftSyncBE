import { IsString, IsEnum, IsOptional } from 'class-validator';
import { SwapType } from '@prisma/client';

export class CreateSwapRequestDto {
  @IsString()
  shiftId: string;

  @IsEnum(SwapType)
  type: SwapType;

  @IsString()
  @IsOptional()
  targetStaffId?: string;
}
