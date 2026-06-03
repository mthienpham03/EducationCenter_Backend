import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { MailService } from './utils/mail/services/mail.service';

@Controller('api/v1')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mailService: MailService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-mail')
  async testMail(@Query('email') email: string) {
    if (!email) return { error: 'Please provide ?email=...' };
    const success = await this.mailService.sendAccountCreatedEmail(
      email,
      'Test User',
      '123456',
      'student',
    );
    return { success, message: success ? 'Mail sent' : 'Mail failed' };
  }
}
