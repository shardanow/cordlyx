import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.js';

export const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: (config) => envSchema.parse(config),
  envFilePath: ['.env', '../.env'],
});
