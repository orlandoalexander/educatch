import { useState } from "react";
import SignIn from "./SignIn";
import SignUp from "./SignUp";

export default function Login() {
  const [isSignIn, setIsSignIn] = useState(true);
  return isSignIn ? (
    <SignIn setIsSignIn={setIsSignIn} />
  ) : (
    <SignUp setIsSignIn={setIsSignIn} />
  );
}
