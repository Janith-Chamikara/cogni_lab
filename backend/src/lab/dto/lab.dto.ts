import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum LabStatus {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export class EquipmentPlacementDto {
  @IsString()
  equipmentId: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  positionX: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  positionY: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @IsOptional()
  positionZ?: number;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class ExperimentStepDto {
  @IsNumber()
  @Transform(({ value }) => Number(value))
  stepNumber: number;

  @IsString()
  stepDescription: string;

  @IsOptional()
  @IsString()
  procedure?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  minTolerance?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  maxTolerance?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateLabDto {
  @IsString()
  moduleId: string;

  @IsString()
  labName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  toleranceMin?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  toleranceMax?: number;

  @IsOptional()
  @IsString()
  toleranceUnit?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentPlacementDto)
  equipments?: EquipmentPlacementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperimentStepDto)
  steps?: ExperimentStepDto[];
}

export class UpdateLabDto {
  @IsOptional()
  @IsString()
  labName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  toleranceMin?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  toleranceMax?: number;

  @IsOptional()
  @IsString()
  toleranceUnit?: string;
}

export class UpdateLabEquipmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentPlacementDto)
  equipments: EquipmentPlacementDto[];
}

export class UpdateLabStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperimentStepDto)
  steps: ExperimentStepDto[];
}

export class WireConnectionDto {
  @IsString()
  sourceEquipmentId: string;

  @IsString()
  targetEquipmentId: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  wireColor?: string;
}

export class UpdateWireConnectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireConnectionDto)
  connections: WireConnectionDto[];
}

// ---- Circuit validation ---------------------------------------------------

export class UpdateCircuitRulesDto {
  // Null clears the rules; the lab is then validated with the defaults.
  // Shape is validated by normalizeCircuitRules in the service.
  @IsOptional()
  @IsObject()
  rules: Record<string, unknown> | null;
}

export class StudentComponentDto {
  @IsString()
  id: string;

  @IsString()
  equipmentId: string;

  @IsOptional()
  @IsString()
  labEquipmentId?: string;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;
}

export class StudentActionDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class StudentCircuitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentComponentDto)
  components: StudentComponentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireConnectionDto)
  connections: WireConnectionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedStepIds?: string[];

  // Analytics only; never used for grading.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentActionDto)
  actionLog?: StudentActionDto[];
  // Ask for graph/tree/fingerprint details (instructors or CIRCUIT_DEBUG).
  @IsOptional()
  @IsBoolean()
  debug?: boolean;
}
