import 'reflect-metadata'
import { createApplication } from './app.js'
import { getApiEnvironment } from './environment.js'

const environment = getApiEnvironment()
const app = await createApplication()
await app.listen({ host: '0.0.0.0', port: environment.API_PORT })
