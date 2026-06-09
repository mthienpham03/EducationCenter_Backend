import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialization } from '../models/Specialization.entity';
import { SpecializationsService } from '../services/specializations.service';
import { SpecializationsController } from '../controllers/specializations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Specialization])],
  controllers: [SpecializationsController],
  providers: [SpecializationsService],
  exports: [SpecializationsService, TypeOrmModule],
})
export class SpecializationsModule {}
