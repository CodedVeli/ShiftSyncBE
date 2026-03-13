import { IsArray, IsString } from 'class-validator';

export class PublishScheduleDto {
  @IsArray()
  @IsString({ each: true })
  shiftIds: string[];
}
