import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { createLogger } from '@growthos/logger'
import nodemailer, { type Transporter } from 'nodemailer'
import { getApiEnvironment } from './environment.js'

export class EmailDeliveryError extends Error {
  constructor(readonly reason: 'failed' | 'timeout') {
    super(reason === 'timeout' ? 'Email delivery timed out' : 'Email delivery failed')
    this.name = 'EmailDeliveryError'
  }
}

interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

@Injectable()
export class MailService implements OnApplicationShutdown {
  private transporter: Transporter | undefined
  private readonly environment = getApiEnvironment()
  private readonly logger = createLogger('api', this.environment.LOG_LEVEL)

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const url = `${this.environment.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(token)}`
    await this.send(email, 'Verify your Growth OS email', `Verify your email: ${url}`, url)
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.environment.PUBLIC_WEB_URL}/reset-password?token=${encodeURIComponent(token)}`
    await this.send(email, 'Reset your Growth OS password', `Reset your password: ${url}`, url)
  }

  async sendInvitation(email: string, token: string, organizationName: string): Promise<void> {
    const url = `${this.environment.PUBLIC_WEB_URL}/accept-invitation?token=${encodeURIComponent(token)}`
    await this.send(
      email,
      `Join ${organizationName} in Growth OS`,
      `Accept your invitation to ${organizationName}: ${url}`,
      url,
    )
  }

  onApplicationShutdown(): void {
    this.transporter?.close()
  }

  private getTransporter(): Transporter {
    this.transporter ??= nodemailer.createTransport({
      host: this.environment.SMTP_HOST,
      port: this.environment.SMTP_PORT,
      secure: this.environment.SMTP_SECURE,
      connectionTimeout: this.environment.EMAIL_DELIVERY_TIMEOUT_MS,
      greetingTimeout: this.environment.EMAIL_DELIVERY_TIMEOUT_MS,
      socketTimeout: this.environment.EMAIL_DELIVERY_TIMEOUT_MS,
      ...(this.environment.SMTP_USER && this.environment.SMTP_PASSWORD
        ? { auth: { user: this.environment.SMTP_USER, pass: this.environment.SMTP_PASSWORD } }
        : {}),
    })
    return this.transporter
  }

  private async send(to: string, subject: string, text: string, url: string): Promise<void> {
    const message: EmailMessage = {
      to,
      subject,
      text,
      html: `<p>${escapeHtml(text.replace(url, ''))}</p><p><a href="${escapeHtml(url)}">Continue securely</a></p>`,
    }
    const provider = this.environment.EMAIL_PROVIDER
    this.logger.info({ provider }, 'email delivery started')
    try {
      if (provider === 'resend') await this.sendWithResend(message)
      else await this.sendWithSmtp(message)
      this.logger.info({ provider }, 'email delivery succeeded')
    } catch (error) {
      const deliveryError =
        error instanceof EmailDeliveryError ? error : new EmailDeliveryError('failed')
      this.logger.error(
        { provider, errorClass: deliveryError.name, errorMessage: deliveryError.message },
        'email delivery failed',
      )
      throw deliveryError
    }
  }

  private async sendWithSmtp(message: EmailMessage): Promise<void> {
    try {
      await this.getTransporter().sendMail({ from: this.environment.MAIL_FROM, ...message })
    } catch {
      throw new EmailDeliveryError('failed')
    }
  }

  private async sendWithResend(message: EmailMessage): Promise<void> {
    const apiKey = this.environment.RESEND_API_KEY
    if (!apiKey) throw new EmailDeliveryError('failed')
    const signal = AbortSignal.timeout(this.environment.EMAIL_DELIVERY_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from: this.environment.MAIL_FROM, ...message }),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new EmailDeliveryError('timeout')
      }
      throw new EmailDeliveryError('failed')
    }
    if (!response.ok) throw new EmailDeliveryError('failed')
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character] ?? character
  })
}
