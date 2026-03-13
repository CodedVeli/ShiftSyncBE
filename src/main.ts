import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('ShiftSync API')
    .setDescription('Multi-location staff scheduling platform with constraint enforcement')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Shifts')
    .addTag('Swap Requests')
    .addTag('Analytics')
    .addTag('Users')
    .addTag('Availability')
    .addTag('Notifications')
    .addTag('Audit')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3131;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}
bootstrap();
