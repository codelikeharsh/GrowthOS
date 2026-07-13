import { OrganizationType, RoleName } from '@growthos/db'
import { IsEmail, IsEnum, IsString, IsUUID, Length } from 'class-validator'

export class CreateOrganizationDto {
  @IsString() @Length(1, 160) name!: string
  @IsEnum(OrganizationType) type!: OrganizationType
}

export class UpdateOrganizationDto {
  @IsString() @Length(1, 160) name!: string
}

export class InviteMemberDto {
  @IsEmail() email!: string
  @IsEnum(RoleName) role!: RoleName
}

export class ChangeMemberRoleDto {
  @IsEnum(RoleName) role!: RoleName
}

export class InvitationIdDto {
  @IsUUID() invitationId!: string
}
