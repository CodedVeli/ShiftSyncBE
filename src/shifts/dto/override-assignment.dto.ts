import { IsString } from 'class-validator';

export class OverrideAssignmentDto {
  @IsString()
  staffId: string;

  @IsString()
  reason: string;

  @IsString()
  constraintViolated: string;
}
