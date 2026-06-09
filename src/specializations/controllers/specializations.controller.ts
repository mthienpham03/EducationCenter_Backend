import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { SpecializationsService } from '../services/specializations.service';
import { CreateSpecializationDto } from '../dto/create-specialization.dto';
import { UpdateSpecializationDto } from '../dto/update-specialization.dto';

@ApiTags('Specializations')
@ApiBearerAuth()
@Controller('api/v1/specializations')
@UseGuards(JwtAuthGuard)
export class SpecializationsController {
  constructor(
    private readonly specializationsService: SpecializationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả chuyên ngành' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async findAll() {
    return this.specializationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết chuyên ngành' })
  async findOne(@Param('id') id: string) {
    return this.specializationsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tạo chuyên ngành mới' })
  async create(@Body() createDto: CreateSpecializationDto) {
    return this.specializationsService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cập nhật chuyên ngành' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSpecializationDto,
  ) {
    return this.specializationsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa chuyên ngành' })
  async remove(@Param('id') id: string) {
    return this.specializationsService.remove(id);
  }
}
