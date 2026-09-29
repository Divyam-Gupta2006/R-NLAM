import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'NH-753J-MH' })
  @Matches(/^[A-Z0-9-]{3,32}$/)
  code: string;

  @ApiProperty({ example: 'Wardha–Yavatmal 4-lane Highway' })
  @IsString()
  @Length(3, 200)
  name: string;

  @ApiProperty({ example: 'Roads' })
  @IsString()
  @MaxLength(50)
  sector: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'MH' })
  @Matches(/^[A-Z]{2}$/)
  stateCode: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  stateName: string;

  @ApiProperty({ example: ['MH-WRD'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  districtCodes: string[];

  @ApiProperty({ example: ['Wardha'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  districtNames: string[];

  @ApiProperty({ example: 'National Highways Authority of India' })
  @IsString()
  piaName: string;

  @ApiProperty({ example: 182.5 })
  @IsNumber()
  @IsPositive()
  requiredAreaHa: number;

  @ApiProperty({ example: 4200000000, description: 'Rupees (converted to paise server-side)' })
  @IsNumber()
  @IsPositive()
  estimatedCostRupees: number;
}
