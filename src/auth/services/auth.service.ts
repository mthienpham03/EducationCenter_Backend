import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/services/users.service';
import { RedisService } from '../../utils/redis/redis.service';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../models/User.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING) {
      throw new UnauthorizedException('Account is disabled or locked');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Optionally update lastLoginAt here using user repository

    const payload = { sub: user.id, email: user.email, role: user.role };

    return this.generateTokens(payload);
  }

  private async generateTokens(payload: any) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m') as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Issue new tokens based on decoded info (if user still exists and active)
      const user = await this.usersService.findOne(decoded.sub);
      if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING) {
          throw new UnauthorizedException('Account is disabled or locked');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      return this.generateTokens(payload);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(accessToken: string) {
    try {
      // Decode to get expiration
      const decoded = this.jwtService.decode(accessToken) as any;
      if (decoded && decoded.exp) {
        const expiresInSeconds = decoded.exp - Math.floor(Date.now() / 1000);
        
        if (expiresInSeconds > 0) {
          // Add to Redis blacklist
          await this.redisService.set(`blacklist:token:${accessToken}`, 'true', expiresInSeconds);
        }
      }
      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException('Failed to logout');
    }
  }
}
