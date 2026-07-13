import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import nodemailer, { type Transporter } from 'nodemailer'
import { getApiEnvironment } from './environment.js'

@Injectable()
export class MailService implements OnApplicationShutdown {
  private transporter: Transporter | undefined
  private readonly environment = getApiEnvironment()

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
      host: this.environment.MAILPIT_SMTP_HOST,
      port: this.environment.MAILPIT_SMTP_PORT,
      secure: false,
    })
    return this.transporter
  }

  private async send(to: string, subject: string, text: string, url: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.environment.MAIL_FROM,
      to,
      subject,
      text,
      html: `<p>${escapeHtml(text.replace(url, ''))}</p><p><a href="${escapeHtml(url)}">Continue securely</a></p>`,
    })
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
