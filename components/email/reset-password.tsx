// ============================================
// FILE: components/email/reset-password.tsx
// Responsive password reset email template (Resend/React Email)
// ============================================

import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ForgotPasswordEmailProps {
  userEmail: string;
  resetUrl: string;
  userName?: string;
}

const ForgotPasswordEmail = ({
  userEmail,
  resetUrl,
  userName,
}: ForgotPasswordEmailProps) => {
  const previewText = `Reset your EduPro password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
              <tr>
                <td align="center">
                  <div style={logoContainer}>
                    <span style={logoText}>E</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <Text style={brandName}>EduPro</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={heading}>Reset Your Password</Heading>
            
            <Text style={paragraph}>
              Hi{userName ? ` ${userName}` : ''},
            </Text>
            
            <Text style={paragraph}>
              We received a request to reset the password for the account associated with{' '}
              <span style={emailHighlight}>{userEmail}</span>.
            </Text>
            
            <Text style={paragraph}>
              Click the button below to create a new password. This link will expire in{' '}
              <strong>24 hours</strong> for security reasons.
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            {/* Alternative Link */}
            <Text style={linkText}>
              Or copy and paste this URL into your browser:
            </Text>
            <Text style={urlText}>
              <Link href={resetUrl} style={urlLink}>
                {resetUrl}
              </Link>
            </Text>

            <Hr style={divider} />

            {/* Security Notice */}
            <Section style={securitySection}>
              <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
                <tr>
                  <td width="40" valign="top">
                    <div style={iconContainer}>🔒</div>
                  </td>
                  <td>
                    <Text style={securityTitle}>Security Notice</Text>
                    <Text style={securityText}>
                      If you didn't request this password reset, you can safely ignore this email. 
                      Your password will remain unchanged.
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by EduPro. If you have any questions, please contact our{' '}
              <Link href="mailto:support@edupro.com" style={footerLink}>
                support team
              </Link>
              .
            </Text>
            <Text style={footerAddress}>
              © {new Date().getFullYear()} EduPro. All rights reserved.
            </Text>
            <Text style={footerSmall}>
              You're receiving this email because you requested a password reset for your EduPro account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ForgotPasswordEmail;

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  padding: '20px 0',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '600px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
};

const headerSection = {
  backgroundColor: '#7c3aed',
  borderRadius: '12px 12px 0 0',
  padding: '32px 20px',
};

const logoContainer = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  display: 'inline-block',
  height: '48px',
  width: '48px',
  lineHeight: '48px',
  textAlign: 'center' as const,
};

const logoText = {
  color: '#7c3aed',
  fontSize: '24px',
  fontWeight: '700' as const,
};

const brandName = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '12px 0 0 0',
};

const contentSection = {
  padding: '32px 40px',
};

const heading = {
  color: '#18181b',
  fontSize: '24px',
  fontWeight: '700' as const,
  lineHeight: '1.3',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
};

const paragraph = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px 0',
};

const emailHighlight = {
  color: '#7c3aed',
  fontWeight: '600' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600' as const,
  lineHeight: '1',
  padding: '16px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const linkText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const urlText = {
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
  wordBreak: 'break-all' as const,
};

const urlLink = {
  color: '#7c3aed',
  fontSize: '14px',
  textDecoration: 'underline',
};

const divider = {
  borderColor: '#e4e4e7',
  borderTop: '1px solid #e4e4e7',
  margin: '24px 0',
};

const securitySection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px',
};

const iconContainer = {
  fontSize: '20px',
  lineHeight: '1',
};

const securityTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 4px 0',
};

const securityText = {
  color: '#a16207',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const footer = {
  backgroundColor: '#f4f4f5',
  borderRadius: '0 0 12px 12px',
  padding: '24px 40px',
};

const footerText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const footerLink = {
  color: '#7c3aed',
  textDecoration: 'underline',
};

const footerAddress = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const footerSmall = {
  color: '#a1a1aa',
  fontSize: '11px',
  lineHeight: '16px',
  margin: '0',
  textAlign: 'center' as const,
};