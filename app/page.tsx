"use client";

import { Button } from "@/components/ui/button";
import {
  Authenticated,
  Unauthenticated,
  useAction,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Home() {
  return (
    <>
      <StickyHeader className="px-4 py-2">
        <div className="flex justify-between items-center">
          Don&apos;t spam my email!
          <SignInAndSignUpButtons />
        </div>
      </StickyHeader>
      <main className="container max-w-2xl flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold my-8 text-center">
          Don&apos;t spam my email!
        </h1>
        <Authenticated>
          <SignedInContent />
        </Authenticated>
        <Unauthenticated>
          <p>Click one of the buttons in the top right corner to sign in.</p>
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInAndSignUpButtons() {
  return (
    <div className="flex gap-4">
      <Authenticated>
        <UserButton afterSignOutUrl="#" />
      </Authenticated>
      <Unauthenticated>
        <SignInButton mode="modal">
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button>Sign up</Button>
        </SignUpButton>
      </Unauthenticated>
    </div>
  );
}

function SignedInContent() {
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const validPhone = phoneNumber.match(/^\d{10}$/) !== null;

  const { user } = useUser();
  const watch = useQuery(api.myFunctions.getWatch);
  const startWatching = useAction(api.nodeActions.startWatching);
  const stopWatching = useAction(api.nodeActions.stopWatching);

  if (watch === undefined) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <p>
        Welcome{user ? " " + user.firstName : ""}! This app watches your email
        and notifies you via text message of high priority emails. It determines
        priority depending on how time-sensitive the email is and how important
        the message is to the user. Examples of high priority emails include
        requests for interviews, questions about scheduling, and required
        actions with short deadlines. Examples of low priority emails include
        newsletters, emails that publicize events, or student club
        advertisements.
      </p>
      <br />
      {watch ? (
        <>
          <p className="font-bold">
            We&apos;re currently watching {watch.email} and notifying{" "}
            {watch.phoneNumber}. Click here to have this app stop watching your
            email.
          </p>
          <div>
            <Button
              onClick={() => {
                stopWatching().catch(console.error);
              }}
            >
              Stop watching
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-bold">
            Enter your phone number and click watch. Typical SMS messaging rates
            apply.
          </p>
          <div className="flex w-full items-center space-x-2">
            <Input
              placeholder="XXXXXXXXXX"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
              }}
            />
            <Button
              onClick={() => {
                startWatching({ phoneNumber }).catch(console.error);
              }}
              disabled={!validPhone}
            >
              Watch
            </Button>
          </div>
        </>
      )}
    </>
  );
}
