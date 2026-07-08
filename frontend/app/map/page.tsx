import { redirect } from "next/navigation";

// The map now lives at "/" — keep old links working.
export default function MapRedirect() {
  redirect("/");
}
