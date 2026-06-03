import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './utils/database/database.module';
import { AuthModule } from './auth/modules/auth.module';
import databaseConfig from './configs/database.config';
import jwtConfig from './configs/jwt.config';
import redisConfig from './configs/redis.config';
import { RedisModule } from './utils/redis/redis.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
