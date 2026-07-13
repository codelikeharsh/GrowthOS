import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { getDatabaseClient } from '@growthos/db'
import { IsString, Length } from 'class-validator'
import { AuthenticationGuard } from './authentication.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import { CurrentAuth, type AuthContext } from './request-context.js'

class UpdateProfileDto {
  @IsString() @Length(1, 120) displayName!: string
}

@Controller({ path: 'me', version: '1' })
@UseGuards(AuthenticationGuard)
export class UserController {
  private readonly database = getDatabaseClient()

  @Get()
  async get(@CurrentAuth() auth: AuthContext) {
    const user = await this.database.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true, displayName: true, emailVerifiedAt: true, createdAt: true },
    })
    return user
  }

  @Patch()
  @UseGuards(CsrfGuard)
  async update(@Body() body: UpdateProfileDto, @CurrentAuth() auth: AuthContext) {
    return this.database.user.update({
      where: { id: auth.userId },
      data: { displayName: body.displayName.trim() },
      select: { id: true, email: true, displayName: true },
    })
  }
}
