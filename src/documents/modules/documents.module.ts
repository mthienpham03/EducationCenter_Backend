import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../models/Document.entity';
import { DocumentVersion } from '../models/DocumentVersion.entity';
import { DocumentAccess } from '../models/DocumentAccess.entity';
import { DocumentsController } from '../controllers/documents.controller';
import { DocumentsService } from '../services/documents.service';
import { CloudinaryModule } from '../../utils/cloudinary/modules/cloudinary.module';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { CurriculumChapter } from '../../curriculum/models/CurriculumChapter.entity';
import { Enrollment } from '../../courses/models/Enrollment.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentVersion,
      DocumentAccess,
      Lesson,
      CurriculumChapter,
      Enrollment,
      TeachingAssignment,
    ]),
    CloudinaryModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
