import { Module } from '@nestjs/common'
import { DependenciesService } from './dependencies.service.js'
import { HealthController } from './health.controller.js'

@Module({ controllers: [HealthController], providers: [DependenciesService] })
// NestJS modules are metadata-bearing classes by framework convention.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
