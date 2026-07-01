import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Class, ClassStatus } from '../models/Class.entity';

@Injectable()
export class ClassCronService {
  private readonly logger = new Logger(ClassCronService.name);

  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
  ) {}

  // Chạy lúc 00:05 mỗi ngày
  @Cron('5 0 * * *')
  async updateScheduledClassesToActive() {
    this.logger.log('Bắt đầu chạy Cron Job kiểm tra và cập nhật trạng thái lớp học...');

    const today = new Date();
    // Reset thời gian về 00:00:00 để so sánh chính xác ngày
    today.setHours(0, 0, 0, 0);

    try {
      // Tìm các lớp đang ở trạng thái SCHEDULED và có ngày bắt đầu <= hôm nay
      const classesToActivate = await this.classRepository.find({
        where: {
          status: ClassStatus.SCHEDULED,
          expectedStartDate: LessThanOrEqual(today),
        },
      });

      if (classesToActivate.length === 0) {
        this.logger.log('Không có lớp học nào cần chuyển sang trạng thái ACTIVE hôm nay.');
        return;
      }

      for (const cls of classesToActivate) {
        cls.status = ClassStatus.ACTIVE;
        cls.updatedAt = new Date();
        // Cập nhật người sửa là system (null hoặc id mặc định nếu có)
      }

      await this.classRepository.save(classesToActivate);
      this.logger.log(`Đã chuyển thành công ${classesToActivate.length} lớp học sang trạng thái ACTIVE.`);
    } catch (error) {
      this.logger.error('Lỗi khi chạy Cron Job cập nhật trạng thái lớp học:', error);
    }
  }
}
