// External packages
import {
  Text,
  Column,
  Heading,
  Row,
  Section,
  Button,
  Hr,
} from '@react-email/components';
import { HttpTypes } from '@medusajs/framework/types';

// Components
import EmailLayout, { EmailLayoutProps } from './components/EmailLayout';

type Props = {
  order: Pick<
    HttpTypes.AdminOrder,
    | 'id'
    | 'display_id'
    | 'email'
    | 'currency_code'
    | 'total'
    | 'shipping_address'
  > & {
    items: Pick<
      HttpTypes.AdminOrder['items'][number],
      'id' | 'product_title' | 'variant_title' | 'quantity' | 'total'
    >[];
  };
};

export default function OrderPlacedMerchantEmail({
  order,
  ...emailLayoutProps
}: Props & EmailLayoutProps) {
  const formatter = new Intl.NumberFormat([], {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency: order.currency_code,
  });

  const address = order.shipping_address;

  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl font-medium mt-0 mb-10">
        New order #{order.display_id}
      </Heading>
      <Text className="text-md !mb-8">
        {formatter.format(order.total)} from {order.email}. Open it in the admin
        to prepare and fulfil it.
      </Text>
      <Button
        href={`${
          process.env.BACKEND_URL || 'http://localhost:9000'
        }/app/orders/${order.id}`}
        className="inline-flex items-center focus-visible:outline-none rounded-xs justify-center transition-colors bg-black hover:bg-grayscale-500 text-white h-10 px-6 mb-10">
        Open order in admin
      </Button>

      <Hr className="mb-6" />
      <Section className="mb-6">
        {order.items.map((item) => (
          <Row key={item.id} className="mb-2">
            <Column>
              <Text className="text-base m-0">
                {item.quantity}&times; {item.product_title}
                {item.variant_title ? ` — ${item.variant_title}` : ''}
              </Text>
            </Column>
            <Column align="right">
              <Text className="text-base m-0">
                {formatter.format(item.total)}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      {address && (
        <>
          <Hr className="mb-6" />
          <Text className="text-base m-0 text-grayscale-500">Ship to</Text>
          <Text className="text-base m-0 whitespace-pre-line">
            {[
              [address.first_name, address.last_name]
                .filter(Boolean)
                .join(' '),
              address.company,
              address.address_1,
              address.address_2,
              [address.postal_code, address.city].filter(Boolean).join(' '),
              address.country_code?.toUpperCase(),
              address.phone,
            ]
              .filter(Boolean)
              .join('\n')}
          </Text>
        </>
      )}
    </EmailLayout>
  );
}

OrderPlacedMerchantEmail.PreviewProps = {
  order: {
    id: 'order_01JCNYH6VADAK90W7CBSPV5BT6',
    display_id: 42,
    email: 'customer@example.com',
    currency_code: 'eur',
    total: 189.9,
    shipping_address: {
      first_name: 'Camille',
      last_name: 'Durand',
      company: null,
      address_1: '12 rue de la Paix',
      address_2: null,
      postal_code: '75002',
      city: 'Paris',
      country_code: 'fr',
      phone: '+33 6 12 34 56 78',
    },
    items: [
      {
        id: 'item_01',
        product_title: 'Astrid Curve',
        variant_title: 'Linen / Beige',
        quantity: 1,
        total: 159.9,
      },
      {
        id: 'item_02',
        product_title: 'Cushion',
        variant_title: null,
        quantity: 2,
        total: 30,
      },
    ],
  },
} as unknown as Props;
