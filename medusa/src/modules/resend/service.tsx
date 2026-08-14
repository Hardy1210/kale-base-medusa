import { AbstractNotificationProviderService } from '@medusajs/framework/utils';
import { Logger } from '@medusajs/medusa';
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/types';
import { Resend } from 'resend';
import emails, { subjects } from './emails';
import type { EmailLayoutProps } from './emails/components/EmailLayout';
import { captureException } from '../../lib/sentry';

type InjectedDependencies = {
  logger: Logger;
};

export default class ResendNotificationProviderService extends AbstractNotificationProviderService {
  public static identifier = 'resend';
  private resendClient: Resend;
  private from: string;
  private replyTo?: string;
  private layoutOptions?: EmailLayoutProps;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: unknown) {
    super();

    if (
      typeof options !== 'object' ||
      options === null ||
      !('api_key' in options) ||
      typeof options.api_key !== 'string' ||
      !('from' in options) ||
      typeof options.from !== 'string'
    ) {
      throw new Error(
        `Invalid options provided to Resend module. Expected { api_key: string, from: string }`,
      );
    }

    const layoutOptions: EmailLayoutProps = {};

    if ('siteTitle' in options && typeof options.siteTitle === 'string') {
      layoutOptions.siteTitle = options.siteTitle;
    }

    if ('companyName' in options && typeof options.companyName === 'string') {
      layoutOptions.companyName = options.companyName;
    }

    if (
      'contactEmail' in options &&
      typeof options.contactEmail === 'string' &&
      options.contactEmail
    ) {
      layoutOptions.contactEmail = options.contactEmail;
    }

    if ('footerLinks' in options) {
      if (
        !Array.isArray(options.footerLinks) ||
        !options.footerLinks.every(
          (l) => typeof l.url === 'string' && typeof l.label === 'string',
        )
      ) {
        this.logger.warn(
          `Invalid footer links provided to Resend module. Expected an array of { url: string, label: string } objects.`,
        );
      } else {
        layoutOptions.footerLinks = options.footerLinks;
      }
    }

    if (
      'replyTo' in options &&
      typeof options.replyTo === 'string' &&
      options.replyTo
    ) {
      this.replyTo = options.replyTo;
    }

    this.resendClient = new Resend(options.api_key);
    this.from = options.from;
    this.logger = logger;
    this.layoutOptions = layoutOptions;
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const Template = emails[notification.template];
    const subject = subjects[notification.template] || '';

    if (!Template) {
      const message = `Couldn't find an email template for ${
        notification.template
      }. The valid options are ${Object.keys(emails).join(', ')}`;
      this.logger.error(message);
      captureException(new Error(message), {
        template: notification.template,
        to: notification.to,
      });
      return {};
    }

    if (!subject) {
      this.logger.warn(
        `No subject found for template ${notification.template}. Please add a subject to the emails file.`,
      );
    }

    let data: Awaited<
      ReturnType<typeof this.resendClient.emails.send>
    >['data'];
    let error: Awaited<
      ReturnType<typeof this.resendClient.emails.send>
    >['error'];

    try {
      ({ data, error } = await this.resendClient.emails.send({
        from: this.from,
        to: [notification.to],
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
        subject,
        react: <Template {...this.layoutOptions} {...notification.data} />,
      }));
    } catch (e) {
      // Fallo de red o del SDK. Se relanza para no cambiar el comportamiento
      // actual; el capture solo añade la visibilidad que faltaba.
      captureException(e, {
        template: notification.template,
        to: notification.to,
      });
      throw e;
    }

    if (error) {
      // Este error se traga a propósito para que el pedido no falle por un
      // email. Sin este capture el cliente se quedaría sin confirmación y
      // nadie se enteraría: Sentry solo ve las excepciones NO capturadas.
      this.logger.error(`Failed to send email`, error);
      captureException(error, {
        template: notification.template,
        to: notification.to,
      });
      return {};
    }

    return { id: data.id };
  }
}
