import {
  AgencyClientNoteVisibility,
  AgencyClientRelationshipStatus,
  BusinessDayOfWeek,
  BusinessLocationType,
  BusinessPriceType,
  BusinessSocialPlatform,
} from '@growthos/db'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class CreateAgencyClientDto {
  @IsString() @Length(1, 160) legalName!: string
  @IsOptional() @IsString() @Length(1, 160) tradeName?: string
  @IsOptional() @IsString() @Length(1, 120) servicePlan?: string
  @IsOptional() @IsEnum(AgencyClientRelationshipStatus) status?: AgencyClientRelationshipStatus
  @IsOptional() @IsUUID() accountManagerUserId?: string
  @IsOptional() @IsEmail() clientOwnerEmail?: string
  @IsOptional() @IsString() @Length(1, 100) timezone?: string
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string
  @IsOptional() @Matches(/^[A-Z]{2}$/) countryCode?: string
}

export class ListAgencyClientsDto {
  @IsOptional() @IsString() @Length(1, 160) search?: string
  @IsOptional() @IsEnum(AgencyClientRelationshipStatus) status?: AgencyClientRelationshipStatus
  @IsOptional() @IsUUID() accountManagerUserId?: string
  @IsOptional() @IsUUID() cursor?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20
}

export class UpdateRelationshipDto {
  @IsOptional() @IsString() @Length(1, 120) servicePlan?: string
  @Type(() => Number) @IsInt() @Min(1) version!: number
}

export class TransitionRelationshipDto {
  @IsEnum(AgencyClientRelationshipStatus) status!: AgencyClientRelationshipStatus
  @Type(() => Number) @IsInt() @Min(1) version!: number
}

export class AssignAccountManagerDto {
  @IsOptional() @IsUUID() userId?: string | null
  @Type(() => Number) @IsInt() @Min(1) version!: number
}

export class CreateNoteDto {
  @IsEnum(AgencyClientNoteVisibility) visibility!: AgencyClientNoteVisibility
  @IsString() @Length(1, 5000) body!: string
}

export class UpdateNoteDto {
  @IsString() @Length(1, 5000) body!: string
}

export class ListNotesDto {
  @IsOptional() @IsUUID() cursor?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20
}

export class InviteClientOwnerDto {
  @IsEmail() email!: string
}

export class UpdateBusinessProfileDto {
  @IsOptional() @IsString() @Length(1, 160) legalName?: string
  @IsOptional() @IsString() @Length(1, 160) tradeName?: string
  @IsOptional() @IsString() @Length(1, 300) shortDescription?: string
  @IsOptional() @IsString() @Length(1, 5000) description?: string
  @IsOptional() @IsString() @Length(1, 120) industry?: string
  @IsOptional() @Matches(/^\+[1-9]\d{6,14}$/) phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  websiteDisplayUrl?: string
  @IsOptional() @IsString() @Length(1, 100) timezone?: string
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string
  @IsOptional() @Matches(/^[A-Z]{2}$/) countryCode?: string
  @IsOptional() @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/) primaryLanguage?: string
  @Type(() => Number) @IsInt() @Min(1) version!: number
}

export class CreateLocationDto {
  @IsString() @Length(1, 160) name!: string
  @IsEnum(BusinessLocationType) locationType!: BusinessLocationType
  @IsOptional() @IsString() @Length(1, 200) addressLine1?: string
  @IsOptional() @IsString() @Length(1, 200) addressLine2?: string
  @IsOptional() @IsString() @Length(1, 120) city?: string
  @IsOptional() @IsString() @Length(1, 120) state?: string
  @IsOptional() @IsString() @Length(1, 32) postalCode?: string
  @Matches(/^[A-Z]{2}$/) countryCode!: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number
  @IsOptional() @Matches(/^\+[1-9]\d{6,14}$/) phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsBoolean() isPrimary?: boolean
}

export class UpdateLocationDto extends CreateLocationDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number
  @IsOptional() @IsBoolean() isActive?: boolean
}

export class CreateServiceDto {
  @IsString() @Length(1, 160) name!: string
  @IsOptional() @IsString() @Length(1, 300) shortDescription?: string
  @IsOptional() @IsString() @Length(1, 5000) description?: string
  @IsEnum(BusinessPriceType) priceType!: BusinessPriceType
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) startingPriceMinor?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maximumPriceMinor?: number
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMinutes?: number
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsBoolean() isFeatured?: boolean
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number
}

export class UpdateServiceDto extends CreateServiceDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number
}

export class BusinessHourDto {
  @IsEnum(BusinessDayOfWeek) dayOfWeek!: BusinessDayOfWeek
  @IsBoolean() isClosed!: boolean
  @ValidateIf((item: BusinessHourDto) => !item.isClosed)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  opensAtMinutes?: number
  @ValidateIf((item: BusinessHourDto) => !item.isClosed)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  closesAtMinutes?: number
  @Type(() => Number) @IsInt() @Min(0) displayOrder!: number
}

export class ReplaceBusinessHoursDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours!: BusinessHourDto[]
}

export class CreateSocialLinkDto {
  @IsEnum(BusinessSocialPlatform) platform!: BusinessSocialPlatform
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string
  @IsOptional() @IsString() @Length(1, 120) displayLabel?: string
  @IsOptional() @IsBoolean() isPrimary?: boolean
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number
}

export class UpdateSocialLinkDto extends CreateSocialLinkDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number
}
