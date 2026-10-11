import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryProvider } from '../providers/cloudinary.provider';
import {
  CreateLabEquipmentDto,
  UpdateLabEquipmentDto,
} from './dto/lab-equipment.dto';
import {
  COMPONENT_PRESETS,
  type ComponentDefinition,
  describeEquipmentComponent,
  InvalidComponentDefinitionError,
  normalizeComponentDefinition,
} from '../circuit-validation';

/**
 * Add how the equipment behaves in circuits: its definition (own or preset)
 * and the named terminals the circuit canvas draws.
 */
const withComponent = <
  T extends {
    equipmentName: string;
    equipmentType: string;
    defaultConfigJson: unknown;
    componentSpecJson: unknown;
  },
>(
  equipment: T,
) => ({ ...equipment, ...describeEquipmentComponent(equipment) });

/**
 * Check a component definition from the request. Multipart bodies carry it
 * as JSON text. Undefined leaves it unchanged; null removes it (preset).
 */
const readComponentSpec = (
  value: unknown,
): ComponentDefinition | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  try {
    const parsed: unknown =
      typeof value === 'string' ? JSON.parse(value) : value;
    return normalizeComponentDefinition(parsed);
  } catch (error) {
    if (error instanceof InvalidComponentDefinitionError) {
      throw new BadRequestException(error.message);
    }
    throw new BadRequestException('componentSpec must be valid JSON');
  }
};

const toJson = (definition: ComponentDefinition | null) =>
  definition === null
    ? Prisma.DbNull
    : (definition as unknown as Prisma.InputJsonObject);

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

    const componentSpec = readComponentSpec(dto.componentSpec);
    const hasFields = (componentSpec?.fields.length ?? 0) > 0;

    const equipment = await this.prisma.labEquipment.create({
      data: {
        creatorId,
        equipmentType: dto.equipmentType,
        equipmentName: dto.equipmentName,
        description: dto.description,
        supportsConfiguration: dto.supportsConfiguration ?? hasFields,
        defaultConfigJson: dto.defaultConfigJson ?? undefined,
        ...(componentSpec !== undefined && {
          componentSpecJson: toJson(componentSpec),
        }),
        imageUrl,
      },
    });
    return withComponent(equipment);
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
    return equipments.map(withComponent);
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

    return withComponent(equipment);
  }

  async findByCreator(creatorId: string) {
    const equipments = await this.prisma.labEquipment.findMany({
      where: { creatorId },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return equipments.map(withComponent);
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

    const componentSpec = readComponentSpec(dto.componentSpec);
    let imageUrl = equipment.imageUrl;

    if (image) {
      // Delete old image if exists
      if (equipment.imageUrl) {
        await this.cloudinary.deleteImage(equipment.imageUrl);
      }
      const uploadResult = await this.cloudinary.uploadImage(image);
      imageUrl = uploadResult.public_id;
    }

    const updated = await this.prisma.labEquipment.update({
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
        ...(componentSpec !== undefined && {
          componentSpecJson: toJson(componentSpec),
        }),
        ...(imageUrl !== equipment.imageUrl && { imageUrl }),
      },
    });
    return withComponent(updated);
  }

  /** Ready-made definitions creators can start from. */
  findPresets() {
    return COMPONENT_PRESETS;
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

    const updated = await this.prisma.labEquipment.update({
      where: { id },
      data: {
        imageUrl: uploadResult.public_id,
      },
    });
    return withComponent(updated);
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

    const updated = await this.prisma.labEquipment.update({
      where: { id },
      data: {
        imageUrl: null,
      },
    });
    return withComponent(updated);
  }
}
