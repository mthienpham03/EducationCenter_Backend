import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from './users/models/User.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const userRepository = dataSource.getRepository(User);

  const adminEmail = 'admin@educenter.com';
  const existingAdmin = await userRepository.findOne({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log('Admin account already exists. Skipping...');
  } else {
    console.log('Creating default Admin account...');

    const passwordHash = await bcrypt.hash('admin123', 10);

    const newAdmin = userRepository.create({
      email: adminEmail,
      passwordHash: passwordHash,
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await userRepository.save(newAdmin);
    console.log('Default Admin account created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: admin123`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
