import { redirect } from "next/navigation";

// Sign-up happens automatically on first Google sign-in — send here to login.
export default function RegisterRedirect() {
  redirect("/login");
}
