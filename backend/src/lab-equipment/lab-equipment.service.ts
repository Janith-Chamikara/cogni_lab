import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryProvider } from '../providers/cloudinary.provider';
import {
  CreateLabEquipmentDto,
  UpdateLabEquipmentDto,
} from './dto/lab-equipment.dto';
import { describeTerminals } from '../circuit-validation';

/** Add the named terminals the circuit canvas draws for this equipment. */
const withTerminals = <
  T extends {
    equipmentName: string;
    equipmentType: string;
    defaultConfigJson: unknown;
  },
>(
  equipment: T,
) => ({ ...equipment, terminals: describeTerminals(equipment) });

@Injectable()
export class LabEquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryProvider,
  ) {}

  async create(
    creatorId: string,
    dto: CreateLabEquipmentDto,
    image?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;

    if (image) {
      const uploadResult = await this.cloudinary.uploadImage(image);
      imageUrl = uploadResult.public_id;
    }

    return this.prisma.labEquipment.create({
      data: {
        creatorId,
        equipmentType: dto.equipmentType,
        equipmentName: dto.equipmentName,
        description: dto.description,
        supportsConfiguration: dto.supportsConfiguration ?? false,
        defaultConfigJson: dto.defaultConfigJson ?? undefined,
        imageUrl,
      },
    });
  }

  async findAll() {
    const equipments = await this.prisma.labEquipment.findMany({
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return equipments.map(withTerminals);
  }

  async findOne(id: string) {
    const equipment = await this.prisma.labEquipment.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        usedInLabs: {
          include: {
            lab: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Lab equipment with ID ${id} not found`);
    }

    return withTerminals(equipment);
  }

  async findByCreator(creatorId: string) {
    const equipments = await this.prisma.labEquipment.findMany({
      where: { creatorId },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return equipments.map(withTerminals);
  }

  async update(
    id: string,
    dto: UpdateLabEquipmentDto,
    image?: Express.Multer.File,
  ) {
    const equipment = await this.prisma.labEquipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Lab equipment with ID ${id} not found`);
    }

    let imageUrl = equipment.imageUrl;

    if (image) {
      // Delete old image if exists
      if (equipment.imageUrl) {
        await this.cloudinary.deleteImage(equipment.imageUrl);
      }
      const uploadResult = await this.cloudinary.uploadImage(image);
      imageUrl = uploadResult.public_id;
    }

    return this.prisma.labEquipment.update({
      where: { id },
      data: {
        ...(dto.equipmentType && { equipmentType: dto.equipmentType }),
        ...(dto.equipmentName && { equipmentName: dto.equipmentName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.supportsConfiguration !== undefined && {
          supportsConfiguration: dto.supportsConfiguration,
        }),
        ...(dto.defaultConfigJson !== undefined && {
          defaultConfigJson: dto.defaultConfigJson,
        }),
        ...(imageUrl !== equipment.imageUrl && { imageUrl }),
      },
    });
  }

  async remove(id: string) {
    const equipment = await this.prisma.labEquipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Lab equipment with ID ${id} not found`);
    }

    // Delete image from Cloudinary if exists
    if (equipment.imageUrl) {
      await this.cloudinary.deleteImage(equipment.imageUrl);
    }

    return this.prisma.labEquipment.delete({
      where: { id },
    });
  }

  async updateImage(id: string, image: Express.Multer.File) {
    const equipment = await this.prisma.labEquipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Lab equipment with ID ${id} not found`);
    }

    // Delete old image if exists
    if (equipment.imageUrl) {
      await this.cloudinary.deleteImage(equipment.imageUrl);
    }

    const uploadResult = await this.cloudinary.uploadImage(image);

    return this.prisma.labEquipment.update({
      where: { id },
      data: {
        imageUrl: uploadResult.public_id,
      },
    });
  }

  async removeImage(id: string) {
    const equipment = await this.prisma.labEquipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw new NotFoundException(`Lab equipment with ID ${id} not found`);
    }

    if (equipment.imageUrl) {
      await this.cloudinary.deleteImage(equipment.imageUrl);
    }

    return this.prisma.labEquipment.update({
      where: { id },
      data: {
        imageUrl: null,
      },
    });
  }
}
