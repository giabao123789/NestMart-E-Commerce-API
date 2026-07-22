import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../dto/auth-response.dto';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService, private usersService: UsersService) {
    const opts: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') as string,
      passReqToCallback: true,
    };
    super(opts);
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();
    if (!refreshToken) throw new ForbiddenException('Refresh token không tồn tại');

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isMatch) throw new ForbiddenException('Refresh token không hợp lệ');

    return { ...user, refreshToken };
  }
}