import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || 'STAFF',
        phone: dto.phone,
        staffProfile: dto.role === 'STAFF' || !dto.role ? {
          create: {
            desiredWeeklyHours: 40,
          },
        } : undefined,
      },
      include: {
        staffProfile: true,
      },
    });

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        staffProfile: {
          include: {
            skills: true,
            certifiedLocations: true,
          },
        },
        managerLocations: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: {
          include: {
            skills: true,
            certifiedLocations: true,
          },
        },
        managerLocations: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private generateToken(user: { id: string; email: string }) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }
}
