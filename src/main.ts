import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { TasksModule } from './tasks/tasks.module';

async function bootstrap() {
  const app = await NestFactory.create(TasksModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();