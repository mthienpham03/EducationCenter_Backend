import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../models/Document.entity';
import { DocumentVersion } from '../models/DocumentVersion.entity';
import { DocumentsController } from '../controllers/documents.controller';
import { DocumentsService } from '../services/documents.service';
import { CloudinaryModule } from '../../utils/cloudinary/modules/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentVersion]),
    CloudinaryModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
