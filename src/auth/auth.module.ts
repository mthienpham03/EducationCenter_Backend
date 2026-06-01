import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/models/User.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [],
    providers: [],
    exports: [TypeOrmModule],
})
export class AuthModule {}
