import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLabDto,
  UpdateLabDto,
  UpdateLabEquipmentsDto,
  UpdateLabStepsDto,
  UpdateWireConnectionsDto,
} from './dto/lab.dto';

@Injectable()
export class LabService {
  constructor(private readonly prisma: PrismaService) {}

  async create(instructorId: string, dto: CreateLabDto) {
    const lab = await this.prisma.labInstance.create({
      data: {
        instructorId,
        moduleId: dto.moduleId,
        labName: dto.labName,
        description: dto.description,
        toleranceMin: dto.toleranceMin,
        toleranceMax: dto.toleranceMax,
        toleranceUnit: dto.toleranceUnit,
      },
    });

    // Create equipment placements if provided
    if (dto.equipments && dto.equipments.length > 0) {
      await this.prisma.labInstanceEquipment.createMany({
        data: dto.equipments.map((eq) => ({
          labId: lab.id,
          equipmentId: eq.equipmentId,
          positionX: eq.positionX,
          positionY: eq.positionY,
          positionZ: eq.positionZ ?? 0,
          configJson: eq.configJson as any,
        })),
      });
    }

    // Create experiment steps if provided
    if (dto.steps && dto.steps.length > 0) {
      await this.prisma.experimentStep.createMany({
        data: dto.steps.map((step) => ({
          labId: lab.id,
          stepNumber: step.stepNumber,
          stepDescription: step.stepDescription,
          procedure: step.procedure,
          minTolerance: step.minTolerance,
          maxTolerance: step.maxTolerance,
          unit: step.unit,
        })),
      });
    }

    return this.findOne(lab.id);
  }

  async findAll() {
    return this.prisma.labInstance.findMany({
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        module: {
          select: {
            id: true,
            moduleName: true,
            moduleCode: true,
          },
        },
        _count: {
          select: {
            experimentSteps: true,
            labEquipments: true,
            experimentProgress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        module: {
          select: {
            id: true,
            moduleName: true,
            moduleCode: true,
          },
        },
        labEquipments: {
          include: {
            equipment: {
              include: {
                creator: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        wireConnections: {
          select: {
            id: true,
            sourceEquipmentId: true,
            targetEquipmentId: true,
            sourceHandle: true,
            targetHandle: true,
            wireColor: true,
          },
        },
        experimentSteps: {
          orderBy: {
            stepNumber: 'asc',
          },
        },
      },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    return lab;
  }

  async findByInstructor(instructorId: string) {
    return this.prisma.labInstance.findMany({
      where: { instructorId },
      include: {
        module: {
          select: {
            id: true,
            moduleName: true,
            moduleCode: true,
          },
        },
        _count: {
          select: {
            experimentSteps: true,
            labEquipments: true,
            experimentProgress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByModule(moduleId: string) {
    return this.prisma.labInstance.findMany({
      where: { moduleId },
      include: {
        instructor: {
          select: {
            id: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            experimentSteps: true,
            labEquipments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, dto: UpdateLabDto) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    return this.prisma.labInstance.update({
      where: { id },
      data: {
        labName: dto.labName,
        description: dto.description,
        toleranceMin: dto.toleranceMin,
        toleranceMax: dto.toleranceMax,
        toleranceUnit: dto.toleranceUnit,
      },
    });
  }

  async updateEquipments(id: string, dto: UpdateLabEquipmentsDto) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    // Delete existing equipment placements
    await this.prisma.labInstanceEquipment.deleteMany({
      where: { labId: id },
    });

    // Create new equipment placements
    if (dto.equipments.length > 0) {
      await this.prisma.labInstanceEquipment.createMany({
        data: dto.equipments.map((eq) => ({
          labId: id,
          equipmentId: eq.equipmentId,
          positionX: eq.positionX,
          positionY: eq.positionY,
          positionZ: eq.positionZ ?? 0,
          configJson: eq.configJson as any,
        })),
      });
    }

    return this.findOne(id);
  }

  async updateSteps(id: string, dto: UpdateLabStepsDto) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    // Delete existing steps
    await this.prisma.experimentStep.deleteMany({
      where: { labId: id },
    });

    // Create new steps
    if (dto.steps.length > 0) {
      await this.prisma.experimentStep.createMany({
        data: dto.steps.map((step) => ({
          labId: id,
          stepNumber: step.stepNumber,
          stepDescription: step.stepDescription,
          procedure: step.procedure,
          minTolerance: step.minTolerance,
          maxTolerance: step.maxTolerance,
          unit: step.unit,
        })),
      });
    }

    return this.findOne(id);
  }

  async delete(id: string) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    return this.prisma.labInstance.delete({
      where: { id },
    });
  }

  async getStats(instructorId: string) {
    const [totalLabs, activeLabs, totalProgress] = await Promise.all([
      this.prisma.labInstance.count({
        where: { instructorId },
      }),
      this.prisma.labInstance.count({
        where: {
          instructorId,
          completionStatus: 'IN_PROGRESS',
        },
      }),
      this.prisma.experimentProgress.count({
        where: {
          lab: {
            instructorId,
          },
        },
      }),
    ]);

    return {
      totalLabs,
      activeLabs,
      totalProgress,
    };
  }

  async updateConnections(id: string, dto: UpdateWireConnectionsDto) {
    const lab = await this.prisma.labInstance.findUnique({
      where: { id },
      include: {
        labEquipments: true,
      },
    });

    if (!lab) {
      throw new NotFoundException(`Lab with ID ${id} not found`);
    }

    // Get equipment IDs map for validation
    const equipmentIds = new Set(lab.labEquipments.map((eq) => eq.id));

    // Validate all connections reference valid equipment
    for (const conn of dto.connections) {
      if (!equipmentIds.has(conn.sourceEquipmentId)) {
        throw new NotFoundException(
          `Source equipment ${conn.sourceEquipmentId} not found in lab`,
        );
      }
      if (!equipmentIds.has(conn.targetEquipmentId)) {
        throw new NotFoundException(
          `Target equipment ${conn.targetEquipmentId} not found in lab`,
        );
      }
    }

    // Delete existing connections
    await this.prisma.wireConnection.deleteMany({
      where: { labId: id },
    });

    // Create new connections
    if (dto.connections.length > 0) {
      await this.prisma.wireConnection.createMany({
        data: dto.connections.map((conn) => ({
          labId: id,
          sourceEquipmentId: conn.sourceEquipmentId,
          targetEquipmentId: conn.targetEquipmentId,
          sourceHandle: conn.sourceHandle,
          targetHandle: conn.targetHandle,
          wireColor: conn.wireColor ?? '#374151',
        })),
      });
    }

    return this.findOne(id);
  }
}
