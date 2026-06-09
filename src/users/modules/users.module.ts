import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../models/User.entity';
import { LecturerProfile } from '../../lecturers/models/LecturerProfile.entity';
import { StudentProfile } from '../../students/models/StudentProfile.entity';
import { UsersController } from '../controllers/users.controller';
import { ProfileController } from '../controllers/profile.controller';
import { UsersService } from '../services/users.service';
import { MailModule } from '../../utils/mail/modules/mail.module';
import { CloudinaryModule } from '../../utils/cloudinary/modules/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LecturerProfile, StudentProfile]),
    MailModule,
    CloudinaryModule,
  ],
  controllers: [UsersController, ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
