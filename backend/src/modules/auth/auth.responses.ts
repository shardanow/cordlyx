import { ApiProperty } from '@nestjs/swagger';

/** Docs-only response shapes (runtime returns plain objects, see AuthService). */
export class AuthTokensDto {
  @ApiProperty({
    description: 'Short-lived access token (15m). Send as Authorization: Bearer.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Rotating refresh token (7d). Send in body to /auth/refresh.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
  })
  refreshToken!: string;
}
