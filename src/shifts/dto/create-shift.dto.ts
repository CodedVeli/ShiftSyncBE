import { IsString, IsDateString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  locationId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  requiredSkillId: string;

  @IsInt()
  @Min(1)
  headcountNeeded: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsInt()
  @IsOptional()
  publishCutoffHours?: number;
}
