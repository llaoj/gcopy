"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function EmailCode({
  searchParams,
}: {
  searchParams: { email: string };
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const email = searchParams.email;
  const router = useRouter();

  const createEmailCode = async (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;

    fetch("/api/user/email-code", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ email: email }),
    }).then(async (res: Response) => {
      if (res.status != 200) {
        const body = await res.json();
        setErrorMessage(body.message);
      }
      if (res.status == 200) {
        router.push("/user/login?email=" + email);
      }
    });
  };

  return (
    <form
      onSubmit={createEmailCode}
      className="card w-[32rem] bg-base-100 shadow-xl"
    >
      <div className="card-body gap-4">
        <Image
          src="/gcopy.svg"
          width={50}
          height={50}
          alt="Picture of the author"
        />
        <div className="flex flex-col gap-0">
          <h2 className="card-title">Sign in</h2>
          <span className="text-xs">to continue to GCopy</span>
        </div>
        <p>Support for text, screenshots & file synchronization.</p>
        <div>
          <input
            name="email"
            type="text"
            placeholder="Enter email"
            className="input input-bordered w-full"
            defaultValue={email}
            autoFocus
          />
          <span className="text-xs">Your privacy is important to GCopy!</span>
        </div>
        {errorMessage && <p className="text-error">{errorMessage}</p>}
        <div className="card-actions justify-end">
          <button type="submit" className="btn btn-primary">
            Next
          </button>
        </div>
      </div>
    </form>
  );
}
