import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../../users/models/User.entity';
import { LoginDto } from '../dto/login.dto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
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
}
