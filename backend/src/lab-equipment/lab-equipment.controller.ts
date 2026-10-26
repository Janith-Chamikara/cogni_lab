import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { User as ClerkUser } from '@clerk/backend';
import { LabEquipmentService } from './lab-equipment.service';
import {
  CreateLabEquipmentDto,
  UpdateLabEquipmentDto,
} from './dto/lab-equipment.dto';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: ClerkUser;
}

@Controller('lab-equipment')
export class LabEquipmentController {
  constructor(
    private readonly labEquipmentService: LabEquipmentService,
    private readonly prisma: PrismaService,
  ) {}

  private async getDbUserId(clerkUser: ClerkUser): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('User not found in database');
    }

    return user.id;
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateLabEquipmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
        fileIsRequired: false,
      }),
    )
    image?: Express.Multer.File,
  ) {
    const creatorId = await this.getDbUserId(req.user);
    return this.labEquipmentService.create(creatorId, dto, image);
  }

  @Get()
  async findAll() {
    return this.labEquipmentService.findAll();
  }

  @Get('my-equipment')
  async findMyEquipment(@Req() req: AuthenticatedRequest) {
    const creatorId = await this.getDbUserId(req.user);
    return this.labEquipmentService.findByCreator(creatorId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.labEquipmentService.findOne(id);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLabEquipmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
        fileIsRequired: false,
      }),
    )
    image?: Express.Multer.File,
  ) {
    return this.labEquipmentService.update(id, dto, image);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.labEquipmentService.remove(id);
  }

  @Put(':id/image')
  @UseInterceptors(FileInterceptor('image'))
  async updateImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    image: Express.Multer.File,
  ) {
    return this.labEquipmentService.updateImage(id, image);
  }

  @Delete(':id/image')
  async removeImage(@Param('id') id: string) {
    return this.labEquipmentService.removeImage(id);
  }
}
