import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

interface ForgotPasswordEmailProps {
  userEmail: string;
  resetUrl: string;
}

const ForgotPasswordEmail = (props: ForgotPasswordEmailProps) => {
  const { userEmail, resetUrl} = props;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reset your password - Action required</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto px-[48px] py-[40px]">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[8px]">
                Reset Your Password
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                We received a request to reset your password
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-800 leading-[24px] mb-[16px]">
                Hello,
              </Text>
              <Text className="text-[16px] text-gray-800 leading-[24px] mb-[16px]">
                We received a request to reset the password for your account associated with <strong>{userEmail}</strong>.
              </Text>
              <Text className="text-[16px] text-gray-800 leading-[24px] mb-[24px]">
                If you made this request, click the button below to reset your password:
              </Text>

              {/* Reset Button */}
              <Section className="text-center mb-[24px]">
                <Button
                  href={resetUrl}
                  className="bg-blue-600 text-white px-[32px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  Reset Password
                </Button>
              </Section>

              <Text className="text-[14px] text-gray-600 leading-[20px] mb-[16px]">
                Or copy and paste this link into your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 leading-[20px] mb-[24px] break-all">
                <Link href={resetUrl} className="text-blue-600 underline">
                  {resetUrl}
                </Link>
              </Text>

              <Text className="text-[16px] text-gray-800 leading-[24px] mb-[16px]">
                This link will expire in 24 hours for security reasons.
              </Text>

              <Text className="text-[16px] text-gray-800 leading-[24px]">
                If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.
              </Text>
            </Section>

            <Hr className="border-gray-200 my-[32px]" />

            {/* Security Notice */}
            <Section className="bg-gray-50 rounded-[8px] p-[20px] mb-[32px]">
              <Text className="text-[14px] text-gray-700 leading-[20px] m-0 mb-[8px]">
                <strong>Security tip:</strong>
              </Text>
              <Text className="text-[14px] text-gray-700 leading-[20px] m-0">
                Never share your password with anyone. Our team will never ask for your password via email.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="text-center">
              <Text className="text-[14px] text-gray-600 leading-[20px] mb-[8px]">
                Best regards,<br />
                The Security Team
              </Text>
              <Hr className="border-gray-200 my-[20px]" />
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0 mb-[4px]">
                Your Company Name
              </Text>
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0 mb-[4px]">
                123 Business Street, Suite 100
              </Text>
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0 mb-[8px]">
                City, State 12345
              </Text>
              <Link href="#" className="text-[12px] text-gray-500 underline">
                Unsubscribe
              </Link>
              <Text className="text-[12px] text-gray-500 leading-[16px] m-0 mt-[8px]">
                © 2025 Your Company Name. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ForgotPasswordEmail;