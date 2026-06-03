import { Injectable, Logger } from '@nestjs/common';
// @ts-ignore
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Gửi email chào mừng và cấp mật khẩu tạm cho người dùng mới
   */
  async sendAccountCreatedEmail(
    toEmail: string,
    fullName: string,
    plainPassword: string,
    role: string,
  ) {
    try {
      let roleName = 'Học viên';
      if (role === 'admin') roleName = 'Quản trị viên';
      if (role === 'lecturer') roleName = 'Giảng viên';

      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Chào mừng bạn đến với EduCenter LMS - Tài khoản của bạn đã được khởi tạo',
        template: './account-created',
        context: {
          fullName,
          email: toEmail,
          password: plainPassword,
          roleName,
          loginUrl: 'http://localhost:3000/login', // Domain frontend (có thể lấy từ Config)
        },
      });

      this.logger.log(`Email đã được gửi thành công đến ${toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi email đến ${toEmail}:`, error);
      return false;
    }
  }

  /**
   * Gửi mã OTP khôi phục mật khẩu
   */
  async sendResetPasswordOtp(email: string, otp: string): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Mã xác nhận khôi phục mật khẩu',
        template: './reset-password',
        context: {
          email,
          otp,
        },
      });
      this.logger.log(`OTP khôi phục mật khẩu đã gửi đến ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi OTP đến ${email}:`, error);
      return false;
    }
  }
}
