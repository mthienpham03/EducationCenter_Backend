import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../../users/models/User.entity';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../utils/mail/services/mail.service';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
    private mailService: MailService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { email: loginDto.email } });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc chưa kích hoạt');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const payload = { sub: user.id, role: user.role };

    // Generate tokens
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret')!,
      expiresIn: this.configService.get<string>('jwt.expiresIn') as any,
    });

    // Save session to Redis (for revocation and session management)
    // Key format: session:{userId}
    const expiresInString = this.configService.get<string>('jwt.expiresIn') || '7d';
    let expirySeconds = 604800; // default 7 days
    if (expiresInString.endsWith('d')) {
      expirySeconds = parseInt(expiresInString) * 24 * 60 * 60;
    } else if (expiresInString.endsWith('h')) {
      expirySeconds = parseInt(expiresInString) * 60 * 60;
    } else if (expiresInString.endsWith('m')) {
      expirySeconds = parseInt(expiresInString) * 60;
    }

    await this.redisClient.set(
      `session:${user.id}`,
      accessToken,
      'EX',
      expirySeconds,
    );

    // Update last_login_at
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      },
    };
  }

  async logout(userId: string) {
    // Delete session from Redis
    await this.redisClient.del(`session:${userId}`);
    return { success: true, message: 'Đăng xuất thành công' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new UnauthorizedException('Mật khẩu xác nhận không khớp');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;
    await this.userRepository.save(user);

    // Xóa session hiện tại để bắt buộc đăng nhập lại
    await this.logout(userId);

    return {
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Vì lý do bảo mật, không trả về lỗi "Email không tồn tại" trực tiếp
      // nhưng ở đây trong context thực hành, ta có thể trả về lỗi.
      throw new UnauthorizedException('Email không tồn tại trong hệ thống');
    }

    const redisKey = `otp:${email}`;
    const existingOtp = await this.redisClient.get(redisKey);
    if (existingOtp) {
      throw new UnauthorizedException('Vui lòng đợi hết 60 giây trước khi yêu cầu mã mới');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    // Lưu Redis 60s
    await this.redisClient.set(redisKey, otp, 'EX', 60);

    // Gửi mail
    this.mailService.sendResetPasswordOtp(email, otp).catch(e => console.error(e));

    return {
      success: true,
      message: 'Mã xác nhận đã được gửi đến email của bạn',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, newPassword, confirmPassword } = resetPasswordDto;

    if (newPassword !== confirmPassword) {
      throw new UnauthorizedException('Mật khẩu xác nhận không khớp');
    }

    const redisKey = `otp:${email}`;
    const storedOtp = await this.redisClient.get(redisKey);

    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Mã xác nhận không chính xác hoặc đã hết hạn');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email không tồn tại trong hệ thống');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;
    await this.userRepository.save(user);

    // Xóa OTP khỏi Redis
    await this.redisClient.del(redisKey);

    // Xóa luôn session hiện tại để bắt đăng nhập lại nếu đang login ở đâu đó
    await this.logout(user.id);

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công',
    };
  }
}
