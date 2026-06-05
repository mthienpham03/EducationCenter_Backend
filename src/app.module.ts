import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './utils/database/database.module';
import { AuthModule } from './auth/modules/auth.module';
import databaseConfig from './configs/database.config';
import jwtConfig from './configs/jwt.config';
import redisConfig from './configs/redis.config';
import mailConfig from './configs/mail.config';
import { RedisModule } from './utils/redis/redis.module';
import { MailModule } from './utils/mail/modules/mail.module';
import { UsersModule } from './users/modules/users.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, mailConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    MailModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
