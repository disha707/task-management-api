import { IsString, Length } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @Length(3, 50)
  title: string;
}