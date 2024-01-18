"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Login({
  searchParams,
}: {
  searchParams: { email: string };
}) {
  const email = searchParams.email;
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const validateEmailCode = (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);

    fetch("/api/user/login", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email") as string,
        code: formData.get("code") as string,
      }),
    }).then(async (res: Response) => {
      if (res.status != 200) {
        const body = await res.json();
        setErrorMessage(body.message);
      }
      if (res.status == 200) {
        router.push("/");
      }
    });
  };

  return (
    <form
      onSubmit={validateEmailCode}
      className="card w-[32rem] bg-base-100 shadow-xl"
    >
      <div className="card-body gap-4">
        <Image
          src="/gcopy.svg"
          width={50}
          height={50}
          alt="Picture of the author"
        />
        <div className="flex items-center">
          <a
            className="btn btn-ghost btn-circle btn-xs"
            href={`/user/email-code?email=${email}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </a>
          <span className="ml-1">{email}</span>
        </div>
        <h2 className="card-title">Enter code</h2>
        <p>We emailed a code to {email}. Please enter the code to sign in.</p>

        <div>
          <input name="email" type="hidden" value={email} />
          <input
            name="code"
            type="text"
            placeholder="Enter code"
            className="input input-bordered w-full"
            autoFocus
          />
          <span className="text-xs">Your privacy is important to GCopy!</span>
        </div>
        {errorMessage && <p className="text-error">{errorMessage}</p>}
        <div className="card-actions justify-end">
          <button className="btn btn-primary" type="submit">
            Sign in
          </button>
        </div>
      </div>
    </form>
  );
}
