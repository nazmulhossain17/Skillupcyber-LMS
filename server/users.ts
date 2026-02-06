"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth";

export const signUp = async(formData: FormData) =>{
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    try{
        await auth.api.signUpEmail({
            body: {
                name,
                email,
                password
            }
        })
        return {
            success: true
        }
    } catch (error) {
        if(error instanceof APIError){
            console.log("API ERROR: ", error.message)
            // return {
            //     success: false,
            //     error: error.message
            // }
        }
    }
}

export const signIn = async (credentials: { email: string; password: string }) => {
  const { email, password } = credentials;
  try {
    await auth.api.signInEmail({
      body: {
        email,
        password
      }
    })
    return {
      success: true,
      message: "Successfully signed in!"
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.log("API ERROR: ", error.message)
      return {
        success: false,
        error: error.message
      }
    }
    return {
      success: false,
      error: "An unexpected error occurred"
    }
  }
}