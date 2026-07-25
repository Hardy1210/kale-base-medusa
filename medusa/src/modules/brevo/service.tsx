import { AbstractNotificationProviderService } from '@medusajs/framework/utils';
import { Logger } from '@medusajs/medusa';
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/types';
import { render } from '@react-email/render';
// Plantillas compartidas con Resend: una sola fuente de verdad. Cambiar a Brevo
// NO altera ninguna plantilla; solo cambia cómo se envían (React -> HTML -> API).
import emails, { subjects } from '../resend/emails';
import type { EmailLayoutProps } from '../resend/emails/components/EmailLayout';

type InjectedDependencies = {
  logger: Logger;
};

type BrevoSender = { name?: string; email: string };

/**
 * Convierte "Nombre <correo@dominio.com>" en { name, email } para la API de Brevo.
 */
function parseFrom(from: string): BrevoSender {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1] || undefined, email: match[2] };
  }
  return { email: from.trim() };
}

export default class BrevoNotificationProviderService extends AbstractNotificationProviderService {
  public static identifier = 'brevo';
  private apiKey: string;
  private sender: BrevoSender;
  private replyTo?: string;
  private layoutOptions: EmailLayoutProps;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: unknown) {
    super();

    this.logger = logger;

    if (
      typeof options !== 'object' ||
      options === null ||
      !('api_key' in options) ||
      typeof options.api_key !== 'string' ||
      !('from' in options) ||
      typeof options.from !== 'string'
    ) {
      throw new Error(
        `Invalid options provided to Brevo module. Expected { api_key: string, from: string }`,
      );
    }

    const layoutOptions: EmailLayoutProps = {};

    if ('siteTitle' in options && typeof options.siteTitle === 'string') {
      layoutOptions.siteTitle = options.siteTitle;
    }

    if ('companyName' in options && typeof options.companyName === 'string') {
      layoutOptions.companyName = options.companyName;
    }

    if ('footerLinks' in options) {
      if (
        !Array.isArray(options.footerLinks) ||
        !options.footerLinks.every(
          (l) => typeof l.url === 'string' && typeof l.label === 'string',
        )
      ) {
        this.logger.warn(
          `Invalid footer links provided to Brevo module. Expected an array of { url: string, label: string } objects.`,
        );
      } else {
        layoutOptions.footerLinks = options.footerLinks;
      }
    }

    if ('replyTo' in options && typeof options.replyTo === 'string' && options.replyTo) {
      this.replyTo = options.replyTo;
    }

    this.apiKey = options.api_key;
    this.sender = parseFrom(options.from);
    this.layoutOptions = layoutOptions;
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const Template = emails[notification.template];
    const subject = subjects[notification.template] || '';

    if (!Template) {
      this.logger.error(
        `Couldn't find an email template for ${
          notification.template
        }. The valid options are ${Object.keys(emails).join(', ')}`,
      );
      return {};
    }

    if (!subject) {
      this.logger.warn(
        `No subject found for template ${notification.template}. Please add a subject to the emails file.`,
      );
    }

    const html = await render(
      <Template {...this.layoutOptions} {...notification.data} />,
    );

    const body: Record<string, unknown> = {
      sender: this.sender,
      to: [{ email: notification.to }],
      subject,
      htmlContent: html,
    };

    if (this.replyTo) {
      body.replyTo = { email: this.replyTo };
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(
          `Failed to send email via Brevo (${res.status}): ${errText}`,
        );
        return {};
      }

      const data = (await res.json()) as { messageId?: string };
      return { id: data.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email via Brevo: ${String(error)}`);
      return {};
    }
  }
}
