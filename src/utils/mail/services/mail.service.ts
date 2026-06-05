import { Injectable, Logger } from '@nestjs/common';
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
        subject:
          'Chào mừng bạn đến với EduCenter LMS - Tài khoản của bạn đã được khởi tạo',
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

  /**
   * Gửi email thông báo khóa tài khoản
   */
  async sendAccountLockedEmail(
    toEmail: string,
    fullName: string,
    reason: string,
    lockedUntil: Date | null,
  ): Promise<boolean> {
    try {
      let lockedDuration = 'Vô thời hạn';
      if (lockedUntil) {
        lockedDuration = `Đến ngày ${new Date(lockedUntil).toLocaleString(
          'vi-VN',
          {
            timeZone: 'Asia/Ho_Chi_Minh',
          },
        )}`;
      }

      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Thông báo: Tài khoản EduCenter LMS của bạn đã bị khóa',
        template: './account-locked',
        context: {
          fullName,
          email: toEmail,
          reason,
          lockedDuration,
        },
      });

      this.logger.log(
        `Email thông báo khóa tài khoản đã được gửi đến ${toEmail}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Lỗi khi gửi email khóa tài khoản đến ${toEmail}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Gửi email thông báo mở khóa tài khoản
   */
  async sendAccountUnlockedEmail(
    toEmail: string,
    fullName: string,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Thông báo: Tài khoản EduCenter LMS của bạn đã được mở khóa',
        template: './account-unlocked',
        context: {
          fullName,
          email: toEmail,
          loginUrl: 'http://localhost:3000/login',
        },
      });

      this.logger.log(
        `Email thông báo mở khóa tài khoản đã được gửi đến ${toEmail}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Lỗi khi gửi email mở khóa tài khoản đến ${toEmail}:`,
        error,
      );
      return false;
    }
  }
}
