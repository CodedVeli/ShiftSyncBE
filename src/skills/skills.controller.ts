import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get()
  findAll() {
    return this.skillsService.findAll();
  }
}
