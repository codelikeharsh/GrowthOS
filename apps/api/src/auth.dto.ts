import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsEmail() email!: string
  @IsString() @Length(1, 120) displayName!: string
  @IsString() @Length(12, 128) password!: string
}

export class TokenDto {
  @IsString() @Length(20, 200) token!: string
}

export class LoginDto {
  @IsEmail() email!: string
  @IsString() @MaxLength(128) password!: string
}

export class ForgotPasswordDto {
  @IsEmail() email!: string
}

export class ResetPasswordDto extends TokenDto {
  @IsString() @Length(12, 128) password!: string
}

export class AcceptInvitationDto extends TokenDto {
  @IsOptional() @IsString() @Length(1, 120) displayName?: string
  @IsOptional() @IsString() @Length(12, 128) password?: string
}
