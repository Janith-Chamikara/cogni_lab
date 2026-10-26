import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class CreateLabEquipmentDto {
  @IsString()
  @IsNotEmpty()
  equipmentType: string;

  @IsString()
  @IsNotEmpty()
  equipmentName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  supportsConfiguration?: boolean;

  @IsObject()
  @IsOptional()
  defaultConfigJson?: Record<string, any>;
}

export class UpdateLabEquipmentDto {
  @IsString()
  @IsOptional()
  equipmentType?: string;

  @IsString()
  @IsOptional()
  equipmentName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  supportsConfiguration?: boolean;

  @IsObject()
  @IsOptional()
  defaultConfigJson?: Record<string, any>;
}
