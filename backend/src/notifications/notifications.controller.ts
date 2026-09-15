import { Controller, Get, Post, Param, Query, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RoleName } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Query('userId') userId?: string, @Query('role') role?: RoleName) {
    return this.notificationsService.findAll(userId, role);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('check-breaches')
  async checkBreaches() {
    return this.notificationsService.checkBreaches();
  }
}
