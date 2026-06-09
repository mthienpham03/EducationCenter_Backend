import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialization } from '../models/Specialization.entity';
import { CreateSpecializationDto } from '../dto/create-specialization.dto';
import { UpdateSpecializationDto } from '../dto/update-specialization.dto';

@Injectable()
export class SpecializationsService {
  constructor(
    @InjectRepository(Specialization)
    private readonly specializationRepository: Repository<Specialization>,
  ) {}

  async create(createDto: CreateSpecializationDto) {
    const { name, code, description } = createDto;

    // Check unique name and code
    const existingName = await this.specializationRepository.findOne({
      where: { name },
    });
    if (existingName) {
      throw new BadRequestException('Tên chuyên ngành này đã tồn tại');
    }

    const existingCode = await this.specializationRepository.findOne({
      where: { code: code.toUpperCase() },
    });
    if (existingCode) {
      throw new BadRequestException('Mã chuyên ngành này đã tồn tại');
    }

    const specialization = this.specializationRepository.create({
      name,
      code: code.toUpperCase(),
      description,
    });

    const saved = await this.specializationRepository.save(specialization);
    return {
      success: true,
      message: 'Tạo chuyên ngành thành công',
      data: saved,
    };
  }

  async findAll() {
    const data = await this.specializationRepository.find({
      order: { code: 'ASC' },
    });
    return {
      success: true,
      data,
    };
  }

  async findOne(id: string) {
    const specialization = await this.specializationRepository.findOne({
      where: { id },
    });
    if (!specialization) {
      throw new NotFoundException('Không tìm thấy chuyên ngành');
    }
    return {
      success: true,
      data: specialization,
    };
  }

  async update(id: string, updateDto: UpdateSpecializationDto) {
    const specialization = await this.specializationRepository.findOne({
      where: { id },
    });
    if (!specialization) {
      throw new NotFoundException('Không tìm thấy chuyên ngành');
    }

    const { name, code, description } = updateDto;

    if (name && name !== specialization.name) {
      const existingName = await this.specializationRepository.findOne({
        where: { name },
      });
      if (existingName) {
        throw new BadRequestException('Tên chuyên ngành này đã tồn tại');
      }
      specialization.name = name;
    }

    if (code && code.toUpperCase() !== specialization.code) {
      const existingCode = await this.specializationRepository.findOne({
        where: { code: code.toUpperCase() },
      });
      if (existingCode) {
        throw new BadRequestException('Mã chuyên ngành này đã tồn tại');
      }
      specialization.code = code.toUpperCase();
    }

    if (description !== undefined) {
      specialization.description = description;
    }

    const updated = await this.specializationRepository.save(specialization);

    return {
      success: true,
      message: 'Cập nhật chuyên ngành thành công',
      data: updated,
    };
  }

  async remove(id: string) {
    const specialization = await this.specializationRepository.findOne({
      where: { id },
    });
    if (!specialization) {
      throw new NotFoundException('Không tìm thấy chuyên ngành');
    }

    await this.specializationRepository.remove(specialization);
    return {
      success: true,
      message: 'Xóa chuyên ngành thành công',
    };
  }
}
