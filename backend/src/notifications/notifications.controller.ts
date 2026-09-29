import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'unread', required: false })
  @ApiOperation({ summary: 'Notifications for me or my role in my jurisdiction' })
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.forUser(user, unread === 'true');
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}
