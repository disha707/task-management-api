import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @Length(3, 255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}