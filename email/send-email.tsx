import { Session } from '@/lib/auth-client';
import {Resend} from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// export const sendEmail = async(url: string, user: Session) =>{
//     await resend.emails.send({
//         from: "onboarding@resend.dev",
//         to: user.email,
//         subject: "Verify your email",
//         react: ({url, name: user.name})
//     })
// }