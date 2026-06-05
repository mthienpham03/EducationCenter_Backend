import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/models/User.entity';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User) private userRepository: Repository<User>,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    if (user.status === UserStatus.LOCKED) {
      if (user.lockedUntil && new Date(user.lockedUntil) < new Date()) {
        user.status = UserStatus.ACTIVE;
        user.lockedUntil = null;
        user.lockReason = null;
        await this.userRepository.save(user);
      } else {
        const timeDetail = user.lockedUntil
          ? `đến ${new Date(user.lockedUntil).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
          : 'vô thời hạn';
        throw new UnauthorizedException(
          `Tài khoản của bạn đã bị khóa ${timeDetail}. Lý do: ${user.lockReason || 'Không có lý do cụ thể'}`,
        );
      }
    } else if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Tài khoản đã bị khóa hoặc chưa kích hoạt',
      );
    }

    // Check if session is active in Redis (handle logout revocation)
    const activeSession = await this.redisClient.get(`session:${user.id}`);
    if (!activeSession) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc đã bị đăng xuất',
      );
    }

    return user; // Sẽ được gán vào request.user
  }
}
