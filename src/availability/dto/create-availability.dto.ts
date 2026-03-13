import { IsInt, IsString, IsBoolean, IsOptional, Min, Max, IsDateString } from 'class-validator';

export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isException?: boolean;

  @IsDateString()
  @IsOptional()
  exceptionDate?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
